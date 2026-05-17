/**
 * Redis sliding-window rate limiter using ioredis + Lua atomics.
 *
 * Algorithm: sliding window log with sorted set.
 * Keys:      rl:{prefix}:{hash} — TTL = windowMs
 * TLS:       required for Managed Redis (REDIS_URL with rediss://)
 */

import Redis from 'ioredis';
import type { RateLimiter, RateLimitResult } from './rateLimit.interface';

// ─── Lua scripts (atomic operations) ─────────────────────────────────────────

/**
 * Sliding window check+increment.
 * KEYS[1] = sorted set key
 * ARGV[1] = now (ms)
 * ARGV[2] = window (ms)
 * ARGV[3] = max attempts
 * ARGV[4] = TTL (seconds)
 * Returns: {count, allowed} as [count, 1|0]
 */
const SLIDING_WINDOW_LUA = `
local key     = KEYS[1]
local now     = tonumber(ARGV[1])
local window  = tonumber(ARGV[2])
local max     = tonumber(ARGV[3])
local ttl     = tonumber(ARGV[4])
local cutoff  = now - window

redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)
local count = redis.call('ZCARD', key)

if count >= max then
  return {count, 0}
end

redis.call('ZADD', key, now, now .. ':' .. math.random(1e9))
redis.call('EXPIRE', key, ttl)
return {count + 1, 1}
`;

const BLOCK_LUA = `
local key   = KEYS[1]
local until_ = ARGV[1]
redis.call('SET', key, until_, 'PX', tonumber(ARGV[2]))
return 1
`;

// ─── Client factory ───────────────────────────────────────────────────────────

let _client: Redis | null = null;
let _circuitOpen = false;
let _circuitResetAt = 0;
const CIRCUIT_RESET_MS = 30_000;

export function createRedisClient(redisUrl: string): Redis {
  const isTls = redisUrl.startsWith('rediss://');
  const client = new Redis(redisUrl, {
    tls: isTls ? {} : undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    connectTimeout: 3000,
    enableReadyCheck: false,
    retryStrategy(times) {
      if (times > 3) return null; // stop retrying
      return Math.min(times * 500, 2000);
    },
  });

  client.on('error', (err) => {
    console.error('[redis] Connection error:', err.message);
    _circuitOpen = true;
    _circuitResetAt = Date.now() + CIRCUIT_RESET_MS;
  });
  client.on('ready', () => {
    _circuitOpen = false;
    console.log('[redis] Connected');
  });

  return client;
}

export function getRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (_circuitOpen) {
    if (Date.now() > _circuitResetAt) {
      _circuitOpen = false;
    } else {
      return null; // circuit open — fall back to PG
    }
  }

  if (!_client) {
    _client = createRedisClient(url);
    _client.connect().catch(() => {/* handled in error event */});
  }
  return _client;
}

// ─── RedisRateLimiter ─────────────────────────────────────────────────────────

export class RedisRateLimiter implements RateLimiter {
  private client: Redis;

  constructor(client: Redis) {
    this.client = client;
  }

  async check(key: string, windowMs: number, maxAttempts: number): Promise<RateLimitResult> {
    // Check explicit block key
    const blockKey = `rl:block:${key}`;
    const blockedUntil = await this.client.get(blockKey);
    if (blockedUntil) {
      const until = parseInt(blockedUntil, 10);
      if (Date.now() < until) {
        return { allowed: false, retryAfterMs: until - Date.now() };
      }
    }

    const setKey = `rl:sw:${key}`;
    const now = Date.now();
    const cutoff = now - windowMs;

    // Clean old entries and count
    await this.client.zremrangebyscore(setKey, '-inf', cutoff);
    const count = await this.client.zcard(setKey);

    if (count >= maxAttempts) {
      return { allowed: false, retryAfterMs: windowMs };
    }
    return { allowed: true };
  }

  async increment(key: string, windowMs: number): Promise<number> {
    const setKey = `rl:sw:${key}`;
    const now = Date.now();
    const ttlSeconds = Math.ceil(windowMs / 1000) + 1;

    const result = await (this.client as any).eval(
      SLIDING_WINDOW_LUA,
      1,
      setKey,
      now,
      windowMs,
      999999, // no cap here — check() handles limits
      ttlSeconds
    ) as [number, number];

    return result[0];
  }

  async block(key: string, blockMs: number): Promise<void> {
    const blockKey = `rl:block:${key}`;
    const until = Date.now() + blockMs;
    await this.client.set(blockKey, String(until), 'PX', blockMs);
  }

  async clear(key: string): Promise<void> {
    await this.client.del(`rl:sw:${key}`, `rl:block:${key}`);
  }
}
