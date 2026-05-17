/**
 * Unit tests: password hashing, session ID generation, TOTP, crypto helpers.
 * These run without a database connection.
 */

import { generateToken, sha256, hashIpSubnet, encrypt, decrypt, safeEqual } from '../services/crypto.service';
import { hashPassword, verifyPassword } from '../models/User';
import { generateTotpSecret, verifyTotp, decryptTotpSecret, generateBackupCodes } from '../services/totp.service';
import { checkPassword } from '../services/pwned.service';

describe('Crypto service', () => {
  test('generateToken produces 32-byte base64url tokens', () => {
    const t = generateToken(32);
    expect(Buffer.from(t, 'base64url').length).toBe(32);
  });

  test('generateToken produces unique values', () => {
    const tokens = Array.from({ length: 100 }, () => generateToken(32));
    const unique = new Set(tokens);
    expect(unique.size).toBe(100);
  });

  test('sha256 returns 64-char hex', () => {
    expect(sha256('hello')).toHaveLength(64);
  });

  test('sha256 of same input is deterministic', () => {
    expect(sha256('test')).toBe(sha256('test'));
  });

  test('hashIpSubnet extracts /24 for IPv4', () => {
    const h1 = hashIpSubnet('192.168.1.100');
    const h2 = hashIpSubnet('192.168.1.200');
    const h3 = hashIpSubnet('192.168.2.100');
    expect(h1).toBe(h2);  // same /24
    expect(h1).not.toBe(h3);  // different /24
  });

  test('hashIpSubnet extracts /64 for IPv6', () => {
    const h1 = hashIpSubnet('2001:db8:1:2::1');
    const h2 = hashIpSubnet('2001:db8:1:2::99');
    const h3 = hashIpSubnet('2001:db8:1:3::1');
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });

  test('encrypt/decrypt round-trip', () => {
    const plain = 'JBSWY3DPEHPK3PXP'; // sample TOTP secret
    const enc = encrypt(plain);
    expect(enc).not.toBe(plain);
    expect(decrypt(enc)).toBe(plain);
  });

  test('different calls produce different ciphertext (random IV)', () => {
    const enc1 = encrypt('same');
    const enc2 = encrypt('same');
    expect(enc1).not.toBe(enc2);
  });

  test('decrypt rejects tampered ciphertext', () => {
    const enc = encrypt('secret');
    const parts = enc.split(':');
    parts[2] = '00' + parts[2].slice(2); // corrupt ciphertext
    expect(() => decrypt(parts.join(':'))).toThrow();
  });

  test('safeEqual is true for identical strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
  });

  test('safeEqual is false for different strings', () => {
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
  });
});

describe('Password hashing (Argon2id)', () => {
  test('hashPassword produces valid argon2id hash', async () => {
    const hash = await hashPassword('SuperSecret123!');
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  test('verifyPassword returns true for correct password', async () => {
    const hash = await hashPassword('GoodPassword456!');
    expect(await verifyPassword(hash, 'GoodPassword456!')).toBe(true);
  });

  test('verifyPassword returns false for wrong password', async () => {
    const hash = await hashPassword('GoodPassword456!');
    expect(await verifyPassword(hash, 'WrongPassword456!')).toBe(false);
  });

  test('two hashes of same password differ (unique salts)', async () => {
    const h1 = await hashPassword('same-password-123!');
    const h2 = await hashPassword('same-password-123!');
    expect(h1).not.toBe(h2);
  });
});

describe('Password strength check', () => {
  test('rejects passwords shorter than 12 chars', async () => {
    const r = await checkPassword('short1!');
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/12/);
  });

  test('rejects common passwords', async () => {
    const r = await checkPassword('password123456');
    expect(r.valid).toBe(false);
  });

  test('accepts strong passwords', async () => {
    const r = await checkPassword('X7$mKqL2#vNpR9wZ');
    expect(r.valid).toBe(true);
  }, 10000);
});

describe('TOTP service', () => {
  test('generateTotpSecret returns base32 secret and encrypted form', () => {
    const { secret, encrypted } = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32,}/);
    expect(encrypted).toContain(':');
  });

  test('decryptTotpSecret recovers original secret', () => {
    const { secret, encrypted } = generateTotpSecret();
    expect(decryptTotpSecret(encrypted)).toBe(secret);
  });

  test('verifyTotp validates correct token', () => {
    const { authenticator } = require('otplib');
    const { secret } = generateTotpSecret();
    const token = authenticator.generate(secret);
    expect(verifyTotp(secret, token)).toBe(true);
  });

  test('verifyTotp rejects invalid token', () => {
    const { secret } = generateTotpSecret();
    expect(verifyTotp(secret, '000000')).toBe(false);
  });

  test('generateBackupCodes returns 10 codes of length 8', async () => {
    const { plain, hashed } = await generateBackupCodes();
    expect(plain).toHaveLength(10);
    expect(hashed).toHaveLength(10);
    plain.forEach((c) => expect(c).toHaveLength(8));
  }, 60000);

  test('backup codes are unique', async () => {
    const { plain } = await generateBackupCodes();
    expect(new Set(plain).size).toBe(10);
  }, 60000);
});

describe('Session ID entropy', () => {
  test('256-bit session tokens are unique across 10000 samples', () => {
    const tokens = new Set(Array.from({ length: 10000 }, () => generateToken(32)));
    expect(tokens.size).toBe(10000);
  });

  test('SHA-256 of session token is stable', () => {
    const raw = generateToken(32);
    expect(sha256(raw)).toBe(sha256(raw));
  });
});
