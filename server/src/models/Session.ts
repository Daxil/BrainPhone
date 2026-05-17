import { db } from '../config/database';

export interface SessionRow {
  id: string;
  user_id: string;
  session_version: number;
  expires_at: Date;
  absolute_expires_at: Date;
  created_at: Date;
  last_active_at: Date;
  ip_hash: string;
  ua_hash: string;
  revoked: boolean;
  scope: string[];
}

const IDLE_TTL_MS        = 30 * 60 * 1000;
const ABSOLUTE_TTL_MS    = 12 * 60 * 60 * 1000;
const SCOPED_TTL_MS      = 10 * 60 * 1000; // 10 min for totp_setup scope

export async function createSession(params: {
  id: string;
  userId: string;
  sessionVersion: number;
  ipHash: string;
  uaHash: string;
  scope?: string[];
}): Promise<SessionRow> {
  const now = new Date();
  const hasScope = params.scope && params.scope.length > 0;
  const ttl = hasScope ? SCOPED_TTL_MS : IDLE_TTL_MS;
  const expiresAt = new Date(now.getTime() + ttl);
  const absoluteExpiresAt = new Date(now.getTime() + (hasScope ? SCOPED_TTL_MS : ABSOLUTE_TTL_MS));
  const scope = params.scope ?? [];

  return db.one<SessionRow>(
    `INSERT INTO sessions
      (id, user_id, session_version, expires_at, absolute_expires_at, ip_hash, ua_hash, scope)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      params.id,
      params.userId,
      params.sessionVersion,
      expiresAt,
      absoluteExpiresAt,
      params.ipHash,
      params.uaHash,
      scope,
    ]
  );
}

export async function findSession(sessionId: string): Promise<SessionRow | null> {
  return db.oneOrNone<SessionRow>(
    `SELECT * FROM sessions WHERE id = $1
       AND revoked = FALSE
       AND expires_at > NOW()
       AND absolute_expires_at > NOW()`,
    [sessionId]
  );
}

export async function touchSession(sessionId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + IDLE_TTL_MS);
  await db.none(
    `UPDATE sessions SET expires_at = $1, last_active_at = NOW()
     WHERE id = $2 AND scope = '{}'`,
    [expiresAt, sessionId]
  );
}

export async function upgradeSession(sessionId: string): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + IDLE_TTL_MS);
  const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_TTL_MS);
  await db.none(
    `UPDATE sessions
     SET scope = '{}', expires_at = $1, absolute_expires_at = $2, last_active_at = NOW()
     WHERE id = $3`,
    [expiresAt, absoluteExpiresAt, sessionId]
  );
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.none('UPDATE sessions SET revoked = TRUE WHERE id = $1', [sessionId]);
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.none('UPDATE sessions SET revoked = TRUE WHERE user_id = $1', [userId]);
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.none(
    `DELETE FROM sessions
     WHERE revoked = TRUE
        OR expires_at < NOW() - INTERVAL '1 day'
        OR absolute_expires_at < NOW() - INTERVAL '1 day'`
  );
}
