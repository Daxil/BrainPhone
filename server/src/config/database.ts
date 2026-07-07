import pgPromise from 'pg-promise';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

// SSL only when the URL explicitly requests it (Yandex Cloud / RDS).
// Local PostgreSQL without SSL must NOT receive ssl:{} — it will reject the handshake.
const needsSsl = connectionString.includes('sslmode=require');
connectionString = connectionString
  .replace('?sslmode=require', '')
  .replace('&sslmode=require', '');

// TLS к managed PG. Если задан CA-серт (DB_CA_CERT = путь к .crt) — проверяем
// сертификат нормально. Иначе падаем обратно на rejectUnauthorized:false ТОЛЬКО
// для БД (не глобально), чтобы self-signed серт Yandex не ронял хендшейк.
// Раньше это делалось через NODE_TLS_REJECT_UNAUTHORIZED=0, что отключало
// проверку для всех исходящих TLS-соединений процесса (SMTP/S3/HIBP) — риск MITM.
function buildSslConfig(): false | { ca: string } | { rejectUnauthorized: false } {
  if (!needsSsl) return false;
  const caPath = process.env.DB_CA_CERT;
  if (caPath) {
    try {
      return { ca: fs.readFileSync(caPath, 'utf8') };
    } catch (e: any) {
      console.warn(`⚠️  DB_CA_CERT set but unreadable (${e.message}) — falling back to unverified TLS`);
    }
  } else {
    console.warn('⚠️  DB_CA_CERT not set — DB TLS certificate is NOT verified. Provide the Yandex CA cert in production.');
  }
  return { rejectUnauthorized: false };
}

const sslConfig = buildSslConfig();

console.log('🔌 Connecting to database...');

// A frozen container pauses timers, so idleTimeoutMillis can't reap a socket
// that died during the freeze. The first query after wake then fails with
// `read ECONNRESET` / `Connection terminated`. We transparently retry those
// transient network errors (see withRetry below) — the pool hands out a fresh
// socket on retry — so they must NOT be logged as real errors.
const TRANSIENT_ERROR =
  /ECONNRESET|Connection terminated|ETIMEDOUT|ECONNREFUSED|socket hang up|Client has encountered a connection error/i;

const pgp = pgPromise({
  capSQL: true,
  error: (err: any) => {
    const msg = err?.message || String(err);
    // Transient dead-socket errors are handled by the retry wrapper. If a retry
    // ultimately fails, the caller's own catch logs it with request context, so
    // stay silent here to avoid flooding the logs with recovered errors.
    if (TRANSIENT_ERROR.test(msg)) return;
    console.error('❌ Database error:', msg);
  }
});

// Serverless-tuned pool. The container is frozen between requests, so idle
// connections silently die on the pooler/NAT side. Keep the pool small (so we
// stay well under the DB conn_limit across concurrent instances), expire idle
// sockets quickly, and enable TCP keepalive to detect dead sockets sooner.
const rawDb = pgp({
  connectionString,
  ...(sslConfig ? { ssl: sslConfig } : {}),
  max: 4,
  idleTimeoutMillis: 5000,
  keepAlive: true,
  allowExitOnIdle: true,
});

async function withRetry<T>(fn: () => Promise<T>, tries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt >= tries || !TRANSIENT_ERROR.test(err?.message || '')) throw err;
      // Brief backoff so the pool can drop the dead socket before the next try.
      await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
    }
  }
}

// Query methods that should transparently retry on a dead-socket error.
const RETRY_METHODS = new Set([
  'none', 'one', 'oneOrNone', 'many', 'manyOrNone', 'any', 'result', 'query',
]);

const db = new Proxy(rawDb, {
  get(target, prop, receiver) {
    const orig = Reflect.get(target, prop, receiver);
    if (typeof prop === 'string' && RETRY_METHODS.has(prop) && typeof orig === 'function') {
      return (...args: any[]) => withRetry(() => orig.apply(target, args));
    }
    return orig;
  },
}) as typeof rawDb;

// A dead idle socket (after a serverless freeze) emits an `error` event on the
// underlying node-postgres pool, separate from the query path. Without a listener
// this both spams the logs and can crash the process. Swallow the transient ones
// quietly — the retry wrapper re-runs the actual query on a fresh connection.
rawDb.$pool.on('error', (err: any) => {
  if (TRANSIENT_ERROR.test(err?.message || '')) return;
  console.error('❌ DB pool error:', err?.message || err);
});

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.one('SELECT NOW()');
    console.log('✅ Database connected');
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error);
    return false;
  }
}

export { db };
export default db;
