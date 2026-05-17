#!/usr/bin/env ts-node
/**
 * TOTP encryption key rotation script.
 *
 * Usage:
 *   ts-node src/scripts/rotate_totp_key.ts [--dry-run] [--batch-size=50]
 *
 * Env required:
 *   TOTP_ENCRYPTION_KEYS   = "v1:<base64old>,v2:<base64new>"
 *   TOTP_ENCRYPTION_KEY_ACTIVE = "v2"
 *   DATABASE_URL
 *
 * The script:
 *   1. Reads all users with totp_secret_encrypted IS NOT NULL
 *   2. For each user whose totp_secret_key_version != active version:
 *      - Decrypts with the old key version
 *      - Re-encrypts with the active key
 *      - Updates the DB in a single transaction per batch
 *   3. Is idempotent — safe to re-run
 *   4. Logs progress without emitting any secrets
 */

import dotenv from 'dotenv';
dotenv.config();

import { db } from '../config/database';
import { encrypt, decrypt, getCiphertextVersion } from '../services/crypto.service';

const isDryRun = process.argv.includes('--dry-run');
const batchSizeArg = process.argv.find((a) => a.startsWith('--batch-size='));
const BATCH_SIZE = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 50;

function getActiveVersion(): string {
  return (process.env.TOTP_ENCRYPTION_KEY_ACTIVE ?? 'v1').trim();
}

async function main(): Promise<void> {
  const activeVersion = getActiveVersion();
  console.log(`[rotate] Active key version: ${activeVersion}`);
  console.log(`[rotate] Dry run: ${isDryRun}`);
  console.log(`[rotate] Batch size: ${BATCH_SIZE}`);

  const users = await db.manyOrNone<{
    id: string;
    email: string;
    totp_secret_encrypted: string;
    totp_secret_key_version: string | null;
  }>(
    `SELECT id, email, totp_secret_encrypted, totp_secret_key_version
     FROM users
     WHERE totp_secret_encrypted IS NOT NULL`
  );

  console.log(`[rotate] Users with TOTP secret: ${users.length}`);

  const toMigrate = users.filter((u) => {
    const currentVersion = u.totp_secret_key_version ?? getCiphertextVersion(u.totp_secret_encrypted);
    return currentVersion !== activeVersion;
  });

  console.log(`[rotate] Users needing migration: ${toMigrate.length}`);

  if (toMigrate.length === 0) {
    console.log('[rotate] Nothing to do — all secrets already use active key version');
    process.exit(0);
  }

  let migrated = 0;
  let failed = 0;

  for (let i = 0; i < toMigrate.length; i += BATCH_SIZE) {
    const batch = toMigrate.slice(i, i + BATCH_SIZE);
    const updates: Array<{ id: string; encrypted: string; version: string }> = [];

    for (const user of batch) {
      try {
        const plainSecret = decrypt(user.totp_secret_encrypted);
        const newEncrypted = encrypt(plainSecret); // always uses active key
        const newVersion = activeVersion;
        updates.push({ id: user.id, encrypted: newEncrypted, version: newVersion });
      } catch (err: any) {
        console.error(`[rotate] FAILED to re-encrypt user ${user.id} (${user.email}): ${err.message}`);
        failed++;
      }
    }

    if (!isDryRun && updates.length > 0) {
      await db.tx(async (t) => {
        for (const u of updates) {
          await t.none(
            `UPDATE users
             SET totp_secret_encrypted = $1, totp_secret_key_version = $2, updated_at = NOW()
             WHERE id = $3`,
            [u.encrypted, u.version, u.id]
          );
        }
      });
    }

    migrated += updates.length;
    const batchEnd = Math.min(i + BATCH_SIZE, toMigrate.length);
    console.log(`[rotate] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${updates.length} migrated (${batchEnd}/${toMigrate.length} total)`);
  }

  if (isDryRun) {
    console.log(`[rotate] DRY RUN complete: would migrate ${migrated}, would fail ${failed}`);
  } else {
    console.log(`[rotate] Migration complete: ${migrated} migrated, ${failed} failed`);
  }

  if (failed > 0) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error('[rotate] Fatal:', err.message);
  process.exit(1);
});
