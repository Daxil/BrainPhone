#!/usr/bin/env ts-node
/**
 * CLI: выдать или снять роль superadmin.
 *
 * Usage:
 *   npm run role:superadmin -- chief@hospital.ru            # admin/doctor → superadmin
 *   npm run role:superadmin -- chief@hospital.ru --revoke   # superadmin → admin
 *
 * Роль выдаётся только отсюда (доступ к БД/контейнеру), а не через API:
 * так взломанный admin-аккаунт не может повысить себя или другого.
 * Все сессии пользователя сбрасываются — войти нужно заново.
 */

import dotenv from 'dotenv';
dotenv.config();

import { validateEnv } from '../config/env';
validateEnv();

import { db } from '../config/database';
import { findByEmail, incrementSessionVersion } from '../models/User';
import { logAudit } from '../models/AuthAudit';

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes('--revoke');
  const email = args.find((a) => !a.startsWith('--'));

  if (!email) {
    console.error('❌ Usage: npm run role:superadmin -- <email> [--revoke]');
    process.exit(1);
  }

  const user = await findByEmail(email);
  if (!user) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }

  const from = user.role;
  const to = revoke ? 'admin' : 'superadmin';
  if (revoke && from !== 'superadmin') {
    console.log(`ℹ️  ${user.email} is not a superadmin (role: ${from}) — nothing to do.`);
    process.exit(0);
  }
  if (!revoke && from === 'superadmin') {
    console.log(`ℹ️  ${user.email} is already a superadmin — nothing to do.`);
    process.exit(0);
  }

  await db.none('UPDATE users SET role = $2 WHERE id = $1', [user.id, to]);
  await incrementSessionVersion(user.id);
  await logAudit({
    eventType: 'role_changed',
    userId: user.id,
    email: user.email,
    details: { from, to, via: 'cli' },
  });

  console.log(`✅ ${user.email}: ${from} → ${to}. All sessions revoked — the user must log in again.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
