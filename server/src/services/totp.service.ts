import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import argon2 from 'argon2';
import crypto from 'crypto';
import { encrypt, decrypt } from './crypto.service';

const BACKUP_CODE_COUNT = 10;

/** Generate a new TOTP secret (base32) and return it encrypted for DB storage. */
export function generateTotpSecret(): { secret: string; encrypted: string } {
  const secret = authenticator.generateSecret(20); // 160-bit / 32-char base32 secret
  return { secret, encrypted: encrypt(secret) };
}

/** Decrypt TOTP secret from DB. */
export function decryptTotpSecret(encrypted: string): string {
  return decrypt(encrypted);
}

/** Generate an otpauth:// URI for QR code display. */
export function generateOtpAuthUri(email: string, secret: string): string {
  return authenticator.keyuri(email, 'BrainPhone', secret);
}

/** Render QR code as base64 data URL. */
export async function generateQrCode(otpAuthUri: string): Promise<string> {
  return qrcode.toDataURL(otpAuthUri);
}

/** Verify a 6-digit TOTP token (±1 window for clock drift). */
export function verifyTotp(secret: string, token: string): boolean {
  try {
    authenticator.options = { window: 1 };
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

// ─── Backup codes ────────────────────────────────────────────────────────────

/** Generate 10 random 8-char backup codes. Returns plain codes (for display) and hashed (for DB). */
export async function generateBackupCodes(): Promise<{ plain: string[]; hashed: string[] }> {
  const plain: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    plain.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }

  const hashed = await Promise.all(
    plain.map((code) =>
      argon2.hash(code, {
        type: argon2.argon2id,
        memoryCost: 4096,
        timeCost: 2,
        parallelism: 1,
      })
    )
  );

  return { plain, hashed };
}
