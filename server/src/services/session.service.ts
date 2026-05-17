/**
 * Session lifecycle management.
 * Cookie holds the raw base64url token; DB stores SHA-256(token).
 * Scoped sessions (scope: ['totp_setup']) restrict accessible endpoints.
 */

import { Request, Response } from 'express';
import {
  generateToken,
  sha256,
  hashIpSubnet,
  hashUA,
} from './crypto.service';
import {
  createSession,
  findSession,
  touchSession,
  upgradeSession,
  revokeSession as dbRevoke,
  revokeAllUserSessions as dbRevokeAll,
  SessionRow,
} from '../models/Session';
import { findById } from '../models/User';
import { logAudit } from '../models/AuthAudit';

const COOKIE_NAME = 'sid';

function cookieOptions(isProd: boolean, maxAgeMs?: number) {
  return {
    httpOnly: true,
    secure: isProd,
    // 'none' required for cross-origin fetch with credentials (frontend != backend domain).
    // Safe because: httpOnly=true prevents JS access, Secure=true (prod) enforces HTTPS.
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: maxAgeMs ?? 12 * 60 * 60 * 1000,
  };
}

/** Create a new session, set cookie. Optionally scoped (e.g. totp_setup). */
export async function issueSession(
  res: Response,
  userId: string,
  sessionVersion: number,
  ipHash: string,
  uaHash: string,
  scope: string[] = []
): Promise<string> {
  const rawToken = generateToken(32);
  const sessionId = sha256(rawToken);

  await createSession({ id: sessionId, userId, sessionVersion, ipHash, uaHash, scope });

  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = scope.length > 0 ? 10 * 60 * 1000 : undefined; // scoped: 10 min
  res.cookie(COOKIE_NAME, rawToken, cookieOptions(isProd, maxAge));

  return rawToken;
}

/** Validate session; attaches req.user and req.sessionScope. Returns true if valid. */
export async function validateSession(req: Request, res: Response): Promise<boolean> {
  const rawToken: string | undefined = req.cookies?.[COOKIE_NAME];
  if (!rawToken) return false;

  const sessionId = sha256(rawToken);
  const session = await findSession(sessionId);
  if (!session) return false;

  // Scoped sessions are NOT bound to IP/UA (they come right after set-password in same browser)
  const isScoped = session.scope && session.scope.length > 0;
  // IP binding is disabled in production: behind a cloud load-balancer the
  // forwarded IP can vary per-request, which would invalidate every session
  // for users outside the local network.
  const IP_BINDING_ENABLED = process.env.SESSION_IP_BINDING === 'true';

  if (!isScoped && IP_BINDING_ENABLED) {
    const currentIpHash = hashIpSubnet(req.ip || '');
    if (session.ip_hash !== currentIpHash) {
      await dbRevoke(sessionId);
      await logAudit({ eventType: 'session_rejected_ip', userId: session.user_id });
      clearCookie(res);
      return false;
    }

    const currentUaHash = hashUA(req.headers['user-agent'] || '');
    if (session.ua_hash !== currentUaHash) {
      await dbRevoke(sessionId);
      await logAudit({ eventType: 'session_rejected_ua', userId: session.user_id });
      clearCookie(res);
      return false;
    }
  }

  const user = await findById(session.user_id);
  if (!user) {
    await dbRevoke(sessionId);
    clearCookie(res);
    return false;
  }

  if (user.session_version !== session.session_version) {
    await dbRevoke(sessionId);
    await logAudit({ eventType: 'session_rejected_version', userId: user.id });
    clearCookie(res);
    return false;
  }

  if (!isScoped) {
    await touchSession(sessionId);
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    session_version: user.session_version,
  };
  req.sessionToken = sessionId;
  req.sessionScope = session.scope ?? [];

  return true;
}

/**
 * Upgrade a scoped session to full access (after TOTP setup).
 * Issues a new session ID, revokes the old one.
 */
export async function upgradeToFullSession(
  req: Request,
  res: Response,
  userId: string,
  sessionVersion: number,
  ipHash: string,
  uaHash: string
): Promise<void> {
  if (req.sessionToken) {
    await dbRevoke(req.sessionToken);
  }
  clearCookie(res);
  await issueSession(res, userId, sessionVersion, ipHash, uaHash, []);
}

export async function revokeCurrentSession(req: Request, res: Response): Promise<void> {
  if (req.sessionToken) {
    await dbRevoke(req.sessionToken);
  }
  clearCookie(res);
}

export async function revokeAllSessions(userId: string, res?: Response): Promise<void> {
  await dbRevokeAll(userId);
  if (res) clearCookie(res);
}

function clearCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === 'production';
  // Must include the same SameSite/Secure attributes used when setting the cookie,
  // otherwise some browsers ignore the clear directive.
  res.clearCookie(COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
}

export { SessionRow };
