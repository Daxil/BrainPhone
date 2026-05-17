import pgPromise from 'pg-promise';
import dotenv from 'dotenv';

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

console.log('🔌 Connecting to database...');

const pgp = pgPromise({
  capSQL: true,
  error: (err: any) => {
    console.error('❌ Database error:', err?.message || err);
  }
});

const db = pgp({
  connectionString,
  ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
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
