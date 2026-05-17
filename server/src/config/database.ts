import pgPromise from 'pg-promise';
import dotenv from 'dotenv';

dotenv.config();

let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

// Убираем ?sslmode=require из строки, чтобы не конфликтовало
connectionString = connectionString.replace('?sslmode=require', '').replace('&sslmode=require', '');

console.log('🔌 Connecting to database...');

const pgp = pgPromise({
  capSQL: true,
  error: (err: any) => {
    console.error('❌ Database error:', err?.message || err);
  }
});

// 🔥 КРИТИЧНО: создаём подключение с отключённой проверкой сертификата
const db = pgp({
  connectionString,
  ssl: {
    rejectUnauthorized: false  // ← ОТКЛЮЧАЕТ ПРОВЕРКУ СЕРТИФИКАТА
  }
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
