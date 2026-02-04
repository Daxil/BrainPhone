import pgPromise from 'pg-promise';
import dotenv from 'dotenv';

dotenv.config();

const pgp = pgPromise({
  capSQL: true,
});

const cn = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'medical_data',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
};

export const db = pgp(cn);

export default db;
