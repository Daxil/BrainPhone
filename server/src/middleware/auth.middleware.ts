/**
 * Global authentication middleware.
 * ALL routes are protected by default.
 *
 * Scoped sessions (scope: ['totp_setup']) only allow TOTP setup endpoints.
 */

import { Request, Response, NextFunction } from 'express';
import { validateSession } from '../services/session.service';

const PUBLIC_EXACT = new Set([
  '/health',
  '/healthz',
  '/api/auth/login',
  '/api/auth/login/totp',
]);

// Endpoints accessible with a totp_setup scoped session
const TOTP_SETUP_SCOPE_PATHS = new Set([
  '/api/auth/me',
  '/api/auth/totp/setup',
  '/api/auth/totp/verify',
  '/api/auth/totp/skip',
]);

function isPublicPath(path: string): boolean {
  if (PUBLIC_EXACT.has(path)) return true;
  if (/^\/api\/auth\/invite\/[^/]+/.test(path)) return true;
  if (path.startsWith('/uploads/')) return true;
  return false;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (isPublicPath(req.path)) {
    return next();
  }

  // The compiled SPA (index.html + hashed assets) and its client-side routes are
  // the public frontend bundle; only the API is session-protected. Anything that
  // is not an /api request is handled by the static/SPA handlers downstream, so
  // let unauthenticated GET/HEAD through — otherwise the login page itself (and
  // its assets) 401 before it can ever load.
  if ((req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api/')) {
    return next();
  }

  const valid = await validateSession(req, res);
  if (!valid) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  // Enforce scope restrictions for limited sessions
  const scope: string[] = req.sessionScope ?? [];
  if (scope.includes('totp_setup')) {
    if (!TOTP_SETUP_SCOPE_PATHS.has(req.path)) {
      res.status(403).json({
        success: false,
        error: 'Complete TOTP setup before accessing this resource',
        requiresTotpSetup: true,
      });
      return;
    }
  }

  next();
}
