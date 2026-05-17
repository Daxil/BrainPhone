// Load .env first so DATABASE_URL from file is available
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_ENV = 'test';
// TOTP key for tests (32 bytes of 0xAB)
process.env.TOTP_ENCRYPTION_KEY = Buffer.alloc(32, 0xAB).toString('base64');
// Use TEST_DATABASE_URL override if provided, else fall back to real DATABASE_URL from .env
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
// DATABASE_URL is now whatever .env loaded — no mock override
