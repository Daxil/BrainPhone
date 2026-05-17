#!/usr/bin/env ts-node
/**
 * Apply SQL migrations in order.
 * Usage: npm run migrate
 */
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { db } from '../config/database';

async function run() {
  const migrationsDir = path.join(__dirname, '../../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  // Ensure migrations tracking table exists
  await db.none(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const file of files) {
    const applied = await db.oneOrNone<{ name: string }>(
      'SELECT name FROM _migrations WHERE name = $1',
      [file]
    );
    if (applied) {
      console.log(`⏭  ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await db.tx(async (t) => {
      await t.none(sql);
      await t.none('INSERT INTO _migrations (name) VALUES ($1)', [file]);
    });
    console.log(`✅ ${file}`);
  }

  console.log('All migrations applied.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
