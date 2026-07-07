import { validateEnv } from './config/env';
validateEnv();

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
dotenv.config();

import { authMiddleware } from './middleware/auth.middleware';
import { originCheck } from './middleware/origin.middleware';
import patientRoutes from './routes/patientRoutes';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import { purgeExpiredSessions } from './models/Session';
import { verifySmtp, startMailWorker } from './services/mailer.service';
import { check404RateLimit } from './services/rateLimit.service';

const app: Application = express();
const PORT = Number(process.env.PORT) || 8080;
const IS_PROD = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const explicitOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((o) => o.trim()).filter(Boolean);
const defaultOrigins = ['http://localhost:5173', 'http://localhost:3000'];
const allOrigins = explicitOrigins.length ? explicitOrigins : defaultOrigins;

// Dynamic CORS: allow explicitly listed origins + same-host requests
// (frontend + backend served from one Yandex Cloud container share the same URL).
app.use((req: Request, res: Response, next: NextFunction) => {
  const host = req.headers.host || '';
  const originHeader = req.headers.origin as string | undefined;
  const allowed = new Set(allOrigins);
  // Also allow the exact host this request arrived on
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      callback(null, allowed.has(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  })(req, res, next);
});

// ─── Per-request CSP nonce ────────────────────────────────────────────────────
// Generated CSPRNG nonce; injected into HTML responses and CSP header.
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

// ─── Security headers ─────────────────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const nonce = req.nonce!;
  const isDev = !IS_PROD;

  // In dev: allow unsafe-inline for Vite HMR; in prod: nonce-only
  const scriptSrc: string[] = isDev
    ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]  // Vite HMR needs eval
    : ["'self'", `'nonce-${nonce}'`];

  const styleSrc: string[] = isDev
    ? ["'self'", "'unsafe-inline'"]
    : ["'self'", `'nonce-${nonce}'`];

  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc:     ["'self'"],
        scriptSrc,
        styleSrc,
        imgSrc:         ["'self'", 'data:', 'blob:', 'https://*.yandexcloud.net'],
        mediaSrc:       ["'self'", 'blob:', 'data:', 'https://*.yandexcloud.net'],
        connectSrc:     ["'self'", ...allOrigins, 'https://*.yandexcloud.net', 'https://cloud-api.yandex.net'],
        fontSrc:        ["'self'"],
        objectSrc:      ["'none'"],
        frameSrc:       ["'none'"],
        baseUri:        ["'self'"],
        formAction:     ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: false,
  })(req, res, next);
});

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// ─── Static uploads ───────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Public health checks ─────────────────────────────────────────────────────
app.get('/health',  (_req, res) => res.json({ status: 'OK' }));
app.get('/healthz', (_req, res) => res.json({ status: 'OK' }));

// ─── Auth middleware ──────────────────────────────────────────────────────────
app.use(authMiddleware as express.RequestHandler);
app.use(originCheck);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/patients', patientRoutes);

// ─── SPA static (production only) ────────────────────────────────────────────
// Serve built React app with per-request nonce injected into <script>/<style> tags.
// In Docker: /app/client/dist (root Dockerfile copies there)
// In dev:    ../../client/dist relative to server/dist/
const SPA_DIST = process.env.SPA_DIST_PATH
  || path.join(__dirname, '../../client/dist');
let _spaHtmlTemplate: string | null = null;

function getSpaHtml(): string | null {
  if (!IS_PROD) return null;
  if (!_spaHtmlTemplate) {
    const indexPath = path.join(SPA_DIST, 'index.html');
    if (!fs.existsSync(indexPath)) return null;
    _spaHtmlTemplate = fs.readFileSync(indexPath, 'utf8');
  }
  return _spaHtmlTemplate;
}

if (IS_PROD) {
  // Serve static assets (JS/CSS/images) without nonce — their hashes are fine
  app.use(express.static(SPA_DIST, { index: false }));

  // Catch-all: serve index.html with nonce injected
  app.get('*', (req: Request, res: Response) => {
    const template = getSpaHtml();
    if (!template) {
      res.status(404).send('Frontend not built');
      return;
    }
    const nonce = req.nonce!;
    // Inject nonce into all <script> and <style> tags
    const html = template
      .replace(/<script(\b[^>]*)>/gi, `<script$1 nonce="${nonce}">`)
      .replace(/<style(\b[^>]*)>/gi, `<style$1 nonce="${nonce}">`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });
}

// ─── 404 handler (with rate limit for potential scanning) ────────────────────
app.use(async (req: Request, res: Response) => {
  if (IS_PROD) {
    const rl = await check404RateLimit(req.ip || '');
    if (!rl.allowed) {
      res.status(429).json({ success: false, error: 'Too many requests' });
      return;
    }
  }
  res.status(404).json({ success: false, error: 'Not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const msg = IS_PROD ? 'Internal server error' : err.message;
  console.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, error: msg });
});

// ─── Server startup ───────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await purgeExpiredSessions().catch((e) => console.warn('Session purge:', e.message));
    await verifySmtp();
    startMailWorker();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on http://0.0.0.0:${PORT} [${process.env.NODE_ENV || 'development'}]`);
      // Build marker — if this line is missing from the logs, the container is
      // running an OLD image and the latest code was NOT deployed.
      console.log('🟢 BUILD MARKER: db-reconnect+retry+silence v2025-07-07');
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
