#!/usr/bin/env ts-node
/**
 * CLI seeder: create the first admin user.
 *
 * Usage:
 *   SEED_ADMIN_EMAIL=admin@hospital.ru SEED_ADMIN_PASSWORD=<strong> ts-node src/scripts/seed-admin.ts
 *
 * Reads from env vars — never hardcodes credentials.
 * Safe to run multiple times (idempotent: skips if email exists).
 */

import dotenv from 'dotenv';
dotenv.config();

import { validateEnv } from '../config/env';
validateEnv();

import { db } from '../config/database';
import { findByEmail, hashPassword } from '../models/User';
import { checkPassword } from '../services/pwned.service';

async function main() {
  const email    = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('❌ SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set');
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check password strength
  const check = await checkPassword(password);
  if (!check.valid) {
    console.error(`❌ Password rejected: ${check.reason}`);
    process.exit(1);
  }

  const existing = await findByEmail(normalizedEmail);
  if (existing) {
    console.log(`ℹ️  Admin already exists: ${normalizedEmail} — skipping.`);
    process.exit(0);
  }

  const hash = await hashPassword(password);

  await db.none(
    `INSERT INTO users (email, password_hash, role, totp_enabled, totp_verified, session_version)
     VALUES ($1, $2, 'admin', TRUE, FALSE, 0)`,
    [normalizedEmail, hash]
  );

  console.log(`✅ Admin created: ${normalizedEmail}`);
  console.log('   Next step: log in and complete TOTP setup at /api/auth/totp/setup');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
