/**
 * Origin / Referer check for state-changing requests (POST, PUT, PATCH, DELETE).
 * Applied only after authentication (belt-and-suspenders beyond SameSite=Strict).
 * Whitelisted origins come from ALLOWED_ORIGINS env var (comma-separated).
 * Same-host requests (frontend + backend served from the same container) are
 * always allowed — the origin will match the Host header.
 */

import { Request, Response, NextFunction } from 'express';

function getAllowedOrigins(req: Request): Set<string> {
  const env = process.env.ALLOWED_ORIGINS || '';
  const defaults = ['http://localhost:5173', 'http://localhost:3000'];
  const explicit: string[] = env ? env.split(',').map((o) => o.trim()).filter(Boolean) : defaults;

  // Auto-allow the same host this request arrived on (same-container deployments).
  const proto = req.protocol || 'https';
  const host = req.get('host') || '';
  if (host) {
    explicit.push(`${proto}://${host}`);
    // Also cover plain https when behind a TLS-terminating proxy
    if (proto === 'http') explicit.push(`https://${host}`);
  }

  return new Set(explicit);
}

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function originCheck(req: Request, res: Response, next: NextFunction): void {
  if (!STATE_CHANGING.has(req.method)) return next();

  // Allow server-side / CLI clients that send no Origin/Referer
  if (!req.headers.origin && !req.headers.referer) return next();

  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const allowed = getAllowedOrigins(req);

  if (origin) {
    if (!allowed.has(origin)) {
      res.status(403).json({ success: false, error: 'Invalid origin' });
      return;
    }
  } else if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (!allowed.has(refOrigin)) {
        res.status(403).json({ success: false, error: 'Invalid referer' });
        return;
      }
    } catch {
      res.status(403).json({ success: false, error: 'Invalid referer' });
      return;
    }
  }

  next();
}
