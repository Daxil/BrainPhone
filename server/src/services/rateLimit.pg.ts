/**
 * PostgreSQL-backed sliding-window rate limiter.
 * Uses the existing rate_limits table.
 */

import { db } from '../config/database';
import type { RateLimiter, RateLimitResult } from './rateLimit.interface';

export class PgRateLimiter implements RateLimiter {
  async check(key: string, windowMs: number, maxAttempts: number): Promise<RateLimitResult> {
    const windowInterval = `${Math.ceil(windowMs / 1000)} seconds`;
    const row = await db.oneOrNone<{
      attempts: number;
      window_start: Date;
      blocked_until: Date | null;
    }>(
      'SELECT attempts, window_start, blocked_until FROM rate_limits WHERE key = $1',
      [key]
    );

    if (!row) return { allowed: true };

    if (row.blocked_until && row.blocked_until > new Date()) {
      return { allowed: false, retryAfterMs: row.blocked_until.getTime() - Date.now() };
    }

    if (Date.now() - row.window_start.getTime() > windowMs) {
      return { allowed: true };
    }

    if (row.attempts >= maxAttempts) {
      return {
        allowed: false,
        retryAfterMs: row.window_start.getTime() + windowMs - Date.now(),
      };
    }

    return { allowed: true };
  }

  async increment(key: string, windowMs: number): Promise<number> {
    const windowInterval = `${Math.ceil(windowMs / 1000)} seconds`;
    const row = await db.one<{ attempts: number }>(
      `INSERT INTO rate_limits (key, attempts, window_start)
       VALUES ($1, 1, NOW())
       ON CONFLICT (key) DO UPDATE
         SET attempts = CASE
               WHEN rate_limits.window_start < NOW() - $2::interval THEN 1
               ELSE rate_limits.attempts + 1
             END,
             window_start = CASE
               WHEN rate_limits.window_start < NOW() - $2::interval THEN NOW()
               ELSE rate_limits.window_start
             END,
             last_attempt_at = NOW()
       RETURNING attempts`,
      [key, windowInterval]
    );
    return row.attempts;
  }

  async block(key: string, blockMs: number): Promise<void> {
    const until = new Date(Date.now() + blockMs);
    await db.none(
      `INSERT INTO rate_limits (key, attempts, blocked_until, window_start)
       VALUES ($1, 1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET blocked_until = $2`,
      [key, until]
    );
  }

  async clear(key: string): Promise<void> {
    await db.none('DELETE FROM rate_limits WHERE key = $1', [key]);
  }
}
