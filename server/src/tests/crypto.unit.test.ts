/**
 * Unit tests for multi-key TOTP encryption and key rotation.
 */

const KEY1 = Buffer.alloc(32, 0x01).toString('base64'); // 32 bytes of 0x01
const KEY2 = Buffer.alloc(32, 0x02).toString('base64'); // 32 bytes of 0x02

describe('Multi-key TOTP encryption', () => {
  const plaintext = 'JBSWY3DPEHPK3PXP'; // typical TOTP base32 secret

  test('encrypt+decrypt roundtrip with single key (legacy mode)', () => {
    process.env.TOTP_ENCRYPTION_KEY = KEY1;
    delete process.env.TOTP_ENCRYPTION_KEYS;
    delete process.env.TOTP_ENCRYPTION_KEY_ACTIVE;

    // Re-import to pick up new env
    jest.resetModules();
    const { encrypt, decrypt } = require('../services/crypto.service');

    const ciphertext = encrypt(plaintext);
    expect(ciphertext.startsWith('v1:')).toBe(true);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  test('decrypt legacy format (3-part, no version prefix)', () => {
    process.env.TOTP_ENCRYPTION_KEY = KEY1;
    delete process.env.TOTP_ENCRYPTION_KEYS;

    jest.resetModules();
    const crypto = require('crypto');
    const { decrypt } = require('../services/crypto.service');

    // Manually create old-format ciphertext
    const key = Buffer.from(KEY1, 'base64');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const legacyFmt = `${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`;

    expect(decrypt(legacyFmt)).toBe(plaintext);
  });

  test('multi-key: encrypt with v2, decrypt with v2', () => {
    process.env.TOTP_ENCRYPTION_KEYS = `v1:${KEY1},v2:${KEY2}`;
    process.env.TOTP_ENCRYPTION_KEY_ACTIVE = 'v2';

    jest.resetModules();
    const { encrypt, decrypt } = require('../services/crypto.service');

    const ct = encrypt(plaintext);
    expect(ct.startsWith('v2:')).toBe(true);
    expect(decrypt(ct)).toBe(plaintext);
  });

  test('multi-key: data encrypted with v1 still decryptable when v2 is active', () => {
    // First encrypt with v1
    process.env.TOTP_ENCRYPTION_KEYS = `v1:${KEY1}`;
    process.env.TOTP_ENCRYPTION_KEY_ACTIVE = 'v1';
    jest.resetModules();
    const { encrypt: encV1 } = require('../services/crypto.service');
    const ctV1 = encV1(plaintext);

    // Now add v2 as active
    process.env.TOTP_ENCRYPTION_KEYS = `v1:${KEY1},v2:${KEY2}`;
    process.env.TOTP_ENCRYPTION_KEY_ACTIVE = 'v2';
    jest.resetModules();
    const { decrypt: decV2 } = require('../services/crypto.service');

    expect(decV2(ctV1)).toBe(plaintext);
  });

  test('getCiphertextVersion returns correct version', () => {
    process.env.TOTP_ENCRYPTION_KEYS = `v1:${KEY1},v2:${KEY2}`;
    process.env.TOTP_ENCRYPTION_KEY_ACTIVE = 'v2';
    jest.resetModules();
    const { encrypt, getCiphertextVersion } = require('../services/crypto.service');

    const ct = encrypt(plaintext);
    expect(getCiphertextVersion(ct)).toBe('v2');
  });

  test('getCiphertextVersion returns v1 for legacy format', () => {
    jest.resetModules();
    const { getCiphertextVersion } = require('../services/crypto.service');
    expect(getCiphertextVersion('aabbcc:ddeeff:112233')).toBe('v1');
  });

  test('decrypt with wrong key version throws', () => {
    process.env.TOTP_ENCRYPTION_KEYS = `v1:${KEY1}`;
    process.env.TOTP_ENCRYPTION_KEY_ACTIVE = 'v1';
    jest.resetModules();
    const { decrypt } = require('../services/crypto.service');

    // v3 doesn't exist in registry
    const fakeCt = `v3:aabbcc:ddeeff:112233`;
    expect(() => decrypt(fakeCt)).toThrow();
  });
});
