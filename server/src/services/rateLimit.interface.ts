export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

export interface RateLimiter {
  check(key: string, windowMs: number, maxAttempts: number): Promise<RateLimitResult>;
  increment(key: string, windowMs: number): Promise<number>;
  block(key: string, blockMs: number): Promise<void>;
  clear(key: string): Promise<void>;
}
