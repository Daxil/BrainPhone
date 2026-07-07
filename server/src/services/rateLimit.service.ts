/**
 * Rate limiter facade.
 * Uses RedisRateLimiter if REDIS_URL is set, falls back to PgRateLimiter.
 * For login: fail-closed if Redis is down (security-critical).
 * For email: fall back to PG silently.
 */

import { sha256 } from './crypto.service';
import type { RateLimiter, RateLimitResult } from './rateLimit.interface';
import { PgRateLimiter } from './rateLimit.pg';
import { RedisRateLimiter, getRedisClient } from './rateLimit.redis';

const WINDOW_MS    = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

function backoffMs(attempts: number): number {
  if (attempts <= 5) return 0;
  return Math.min(30_000 * Math.pow(2, attempts - 6), 15 * 60 * 1000);
}

const _pg = new PgRateLimiter();

function getLimiter(failClosed = false): RateLimiter {
  const redis = getRedisClient();
  if (redis) {
    try {
      return new RedisRateLimiter(redis);
    } catch {
      if (failClosed) throw new Error('Rate limiter unavailable');
    }
  }
  return _pg;
}

function loginKey(ip: string, email: string): string {
  return sha256(`login:${ip}:${email.toLowerCase()}`);
}

// ─── Login rate limiting (backward-compatible public API) ─────────────────────

export async function checkRateLimit(ip: string, email: string): Promise<RateLimitResult> {
  try {
    return await getLimiter(false).check(loginKey(ip, email), WINDOW_MS, MAX_ATTEMPTS);
  } catch {
    // Redis circuit open + PG fallback also failed → fail-closed for login
    return { allowed: false, retryAfterMs: 60_000 };
  }
}

export async function recordFailure(ip: string, email: string): Promise<number> {
  const key = loginKey(ip, email);
  const limiter = getLimiter(false);
  const attempts = await limiter.increment(key, WINDOW_MS);
  const bo = backoffMs(attempts);
  if (bo > 0) {
    await limiter.block(key, bo);
  }
  return attempts;
}

export async function clearRateLimit(ip: string, email: string): Promise<void> {
  await getLimiter(false).clear(loginKey(ip, email));
}

// ─── TOTP verification rate limiting ─────────────────────────────────────────
// Ключуем по userId: к этому шагу можно попасть только с подписанной cookie
// totp_pending (т.е. после успешного пароля), поэтому лок-аут по userId не
// эксплуатируется для DoS, зато режет перебор 6-значного кода/backup-кодов.

function totpKey(userId: string): string {
  return sha256(`totp:${userId}`);
}

export async function checkTotpRateLimit(userId: string): Promise<RateLimitResult> {
  try {
    return await getLimiter(false).check(totpKey(userId), WINDOW_MS, MAX_ATTEMPTS);
  } catch {
    return { allowed: false, retryAfterMs: 60_000 };
  }
}

export async function recordTotpFailure(userId: string): Promise<number> {
  const key = totpKey(userId);
  const limiter = getLimiter(false);
  const attempts = await limiter.increment(key, WINDOW_MS);
  const bo = backoffMs(attempts);
  if (bo > 0) await limiter.block(key, bo);
  return attempts;
}

export async function clearTotpRateLimit(userId: string): Promise<void> {
  await getLimiter(false).clear(totpKey(userId));
}

// ─── Generic keyed rate limit (for email, 404, upload, etc.) ─────────────────

/** rl:email:{userId}:{template} — max 1 per 5 min */
export async function checkEmailRateLimit(
  userId: string,
  template: string
): Promise<RateLimitResult> {
  const key = sha256(`email:${userId}:${template}`);
  return getLimiter(false).check(key, 5 * 60 * 1000, 1);
}

export async function recordEmailSent(userId: string, template: string): Promise<void> {
  const key = sha256(`email:${userId}:${template}`);
  await getLimiter(false).increment(key, 5 * 60 * 1000);
}

/** rl:404:{ip} — max 50 per 10 min, then ban */
export async function check404RateLimit(ip: string): Promise<RateLimitResult> {
  const key = sha256(`404:${ip}`);
  const limiter = getLimiter(false);
  const result = await limiter.check(key, 10 * 60 * 1000, 50);
  if (result.allowed) {
    const count = await limiter.increment(key, 10 * 60 * 1000);
    if (count > 50) {
      await limiter.block(key, 30 * 60 * 1000); // 30 min ban
      return { allowed: false, retryAfterMs: 30 * 60 * 1000 };
    }
  }
  return result;
}
