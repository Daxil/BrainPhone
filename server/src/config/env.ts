/**
 * Validates required env vars at startup.
 * Fail fast in production; warn in development.
 */

import { TOTP_ENABLED } from './features';

const REQUIRED_ALWAYS = [
  'DATABASE_URL',
] as const;

export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const required: readonly string[] = REQUIRED_ALWAYS;

  const missing: string[] = [];
  for (const key of required) {
    if (!process.env[key]) missing.push(key);
  }

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('   See server/.env.example for reference.');
    process.exit(1);
  }

  // Validate TOTP encryption key(s) — skipped when TOTP_ENABLED = false
  if (!TOTP_ENABLED) return;

  const multiKeys = process.env.TOTP_ENCRYPTION_KEYS;
  const singleKey = process.env.TOTP_ENCRYPTION_KEY;

  if (!multiKeys && !singleKey) {
    console.error('❌ TOTP_ENCRYPTION_KEY or TOTP_ENCRYPTION_KEYS must be set');
    process.exit(1);
  }

  if (singleKey && !multiKeys) {
    const keyBytes = Buffer.from(singleKey, 'base64');
    if (keyBytes.length !== 32) {
      console.error(`❌ TOTP_ENCRYPTION_KEY must be exactly 32 bytes (got ${keyBytes.length}). Generate with: openssl rand -base64 32`);
      process.exit(1);
    }
  }

  if (multiKeys) {
    for (const entry of multiKeys.split(',')) {
      const colon = entry.indexOf(':');
      if (colon < 0) {
        console.error(`❌ Malformed TOTP_ENCRYPTION_KEYS entry: "${entry}" (expected "vN:base64key")`);
        process.exit(1);
      }
      const b64 = entry.slice(colon + 1).trim();
      const keyBytes = Buffer.from(b64, 'base64');
      if (keyBytes.length !== 32) {
        console.error(`❌ Key "${entry.slice(0, colon)}" in TOTP_ENCRYPTION_KEYS must be 32 bytes`);
        process.exit(1);
      }
    }
  }

}
