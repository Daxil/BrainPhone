import { db } from '../config/database';
import argon2 from 'argon2';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  role: 'admin' | 'doctor';
  totp_secret_encrypted: string | null;
  totp_secret_key_version: string | null;
  totp_enabled: boolean;
  totp_verified: boolean;
  backup_codes: string[] | null;
  session_version: number;
  failed_attempts: number;
  locked_until: Date | null;
  skipped_totp_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function findByEmail(email: string): Promise<UserRow | null> {
  return db.oneOrNone<UserRow>(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );
}

export async function findById(id: string): Promise<UserRow | null> {
  return db.oneOrNone<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
}

export async function createUser(
  email: string,
  role: 'admin' | 'doctor',
  createdBy: string | null
): Promise<UserRow> {
  return db.one<UserRow>(
    `INSERT INTO users (email, role, created_by)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [email.toLowerCase().trim(), role, createdBy]
  );
}

export async function setPasswordHash(userId: string, hash: string): Promise<void> {
  await db.none(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [hash, userId]
  );
}

export async function setTotpSecret(
  userId: string,
  encryptedSecret: string,
  keyVersion?: string
): Promise<void> {
  await db.none(
    `UPDATE users
     SET totp_secret_encrypted = $1, totp_secret_key_version = $2,
         totp_verified = FALSE, updated_at = NOW()
     WHERE id = $3`,
    [encryptedSecret, keyVersion ?? null, userId]
  );
}

export async function enableTotp(
  userId: string,
  encryptedBackupCodes: string[]
): Promise<void> {
  await db.none(
    `UPDATE users
     SET totp_enabled = TRUE, totp_verified = TRUE, backup_codes = $1, updated_at = NOW()
     WHERE id = $2`,
    [encryptedBackupCodes, userId]
  );
}

export async function disableTotp(userId: string): Promise<void> {
  await db.none(
    `UPDATE users
     SET totp_enabled = FALSE, totp_verified = FALSE,
         totp_secret_encrypted = NULL, totp_secret_key_version = NULL,
         backup_codes = NULL, updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
}

export async function incrementFailedAttempts(userId: string): Promise<number> {
  const row = await db.one<{ failed_attempts: number }>(
    `UPDATE users SET failed_attempts = failed_attempts + 1, updated_at = NOW()
     WHERE id = $1 RETURNING failed_attempts`,
    [userId]
  );
  return row.failed_attempts;
}

export async function lockAccount(userId: string, until: Date): Promise<void> {
  await db.none(
    `UPDATE users SET locked_until = $1, updated_at = NOW() WHERE id = $2`,
    [until, userId]
  );
}

export async function resetFailedAttempts(userId: string): Promise<void> {
  await db.none(
    `UPDATE users SET failed_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1`,
    [userId]
  );
}

export async function incrementSessionVersion(userId: string): Promise<void> {
  await db.none(
    `UPDATE users SET session_version = session_version + 1, updated_at = NOW() WHERE id = $1`,
    [userId]
  );
}

export async function listUsers(): Promise<UserRow[]> {
  return db.manyOrNone<UserRow>(
    `SELECT id, email, role, totp_enabled, totp_verified,
            session_version, failed_attempts, locked_until, created_at, created_by
     FROM users ORDER BY created_at DESC`
  );
}

export async function deleteUser(userId: string): Promise<void> {
  await db.none('DELETE FROM users WHERE id = $1', [userId]);
}

export async function consumeBackupCode(
  userId: string,
  codes: string[],
  plainCode: string
): Promise<boolean> {
  for (let i = 0; i < codes.length; i++) {
    try {
      const matches = await argon2.verify(codes[i], plainCode);
      if (matches) {
        const remaining = [...codes];
        remaining.splice(i, 1);
        await db.none(
          'UPDATE users SET backup_codes = $1, updated_at = NOW() WHERE id = $2',
          [remaining, userId]
        );
        return true;
      }
    } catch {
      // continue
    }
  }
  return false;
}
