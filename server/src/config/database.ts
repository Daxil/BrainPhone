import pgPromise from 'pg-promise';
import dotenv from 'dotenv';

dotenv.config();

const pgp = pgPromise({
  capSQL: true,
  error: (err: any) => {
    console.error('Database error:', err?.message || err);
  }
});


const cn = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'root',         
};

export const db = pgp(cn);

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.one('SELECT NOW()');
    console.log('✅ Подключение к БД успешно');
    return true;
  } catch (error) {
    console.error('❌ Подключение к БД не удалось:', error);
    return false;
  }
}

export default db;
