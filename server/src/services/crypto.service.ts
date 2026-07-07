import crypto from 'crypto';

// ─── Token generation ────────────────────────────────────────────────────────

export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(input: string | Buffer): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

// ─── IP / UA hashing ─────────────────────────────────────────────────────────

export function extractSubnet(ip: string): string {
  if (!ip) return 'unknown';
  const v4mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4mapped) return extractSubnet(v4mapped[1]);
  if (ip.includes(':')) {
    return ip.split(':').slice(0, 4).join(':') + '::/64';
  }
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  return ip;
}

export function hashIpSubnet(ip: string): string {
  return sha256(extractSubnet(ip));
}

export function hashUA(ua: string): string {
  return sha256(ua || '');
}

// ─── Multi-key AES-256-GCM encryption (TOTP secrets) ─────────────────────────
//
// Env vars:
//   TOTP_ENCRYPTION_KEYS  = "v1:<base64>,v2:<base64>"   (multi-key mode)
//   TOTP_ENCRYPTION_KEY_ACTIVE = "v2"                    (which key encrypts new data)
//   TOTP_ENCRYPTION_KEY   = "<base64>"                   (legacy single-key, still supported)
//
// Ciphertext format:
//   New:    "v{n}:{iv_hex}:{tag_hex}:{ct_hex}"
//   Legacy: "{iv_hex}:{tag_hex}:{ct_hex}"         (decrypted with TOTP_ENCRYPTION_KEY)

function parseKeyRegistry(): Map<string, Buffer> {
  const registry = new Map<string, Buffer>();

  const multi = process.env.TOTP_ENCRYPTION_KEYS;
  if (multi) {
    for (const entry of multi.split(',')) {
      const colon = entry.indexOf(':');
      if (colon < 0) throw new Error(`Malformed TOTP_ENCRYPTION_KEYS entry: "${entry}"`);
      const version = entry.slice(0, colon).trim();
      const b64 = entry.slice(colon + 1).trim();
      const key = Buffer.from(b64, 'base64');
      if (key.length !== 32) {
        throw new Error(`Key "${version}" in TOTP_ENCRYPTION_KEYS must be 32 bytes`);
      }
      registry.set(version, key);
    }
  }

  // Also register legacy single key as fallback
  const legacy = process.env.TOTP_ENCRYPTION_KEY;
  if (legacy && !registry.has('v1')) {
    const key = Buffer.from(legacy, 'base64');
    if (key.length === 32) registry.set('v1', key);
  }

  return registry;
}

function getActiveKeyVersion(): string {
  if (process.env.TOTP_ENCRYPTION_KEY_ACTIVE) {
    return process.env.TOTP_ENCRYPTION_KEY_ACTIVE.trim();
  }
  if (process.env.TOTP_ENCRYPTION_KEYS) {
    // Default to last listed key
    const entries = process.env.TOTP_ENCRYPTION_KEYS.split(',');
    const last = entries[entries.length - 1];
    return last.slice(0, last.indexOf(':')).trim();
  }
  return 'v1'; // legacy
}

function getKey(version: string): Buffer {
  const registry = parseKeyRegistry();
  const key = registry.get(version);
  if (!key) {
    throw new Error(`TOTP encryption key version "${version}" not found in TOTP_ENCRYPTION_KEYS`);
  }
  return key;
}

/**
 * Encrypt plaintext with AES-256-GCM using the active key.
 * Returns "v{n}:{iv_hex}:{tag_hex}:{ciphertext_hex}".
 */
export function encrypt(plaintext: string): string {
  const version = getActiveKeyVersion();
  const key = getKey(version);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${version}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt value produced by `encrypt()`.
 * Handles both new format (with version prefix) and legacy format.
 */
export function decrypt(packed: string): string {
  const parts = packed.split(':');

  // New format: "v1:ivHex:tagHex:ctHex"
  if (parts.length === 4 && /^v\d+$/.test(parts[0])) {
    const [version, ivHex, tagHex, ctHex] = parts;
    const key = getKey(version);
    return aesDecrypt(key, ivHex, tagHex, ctHex);
  }

  // Legacy format: "ivHex:tagHex:ctHex"
  if (parts.length === 3) {
    const legacyKey = process.env.TOTP_ENCRYPTION_KEY;
    if (!legacyKey) throw new Error('TOTP_ENCRYPTION_KEY not set (required for legacy secrets)');
    const key = Buffer.from(legacyKey, 'base64');
    if (key.length !== 32) throw new Error('TOTP_ENCRYPTION_KEY must be 32 bytes');
    return aesDecrypt(key, parts[0], parts[1], parts[2]);
  }

  throw new Error('Invalid encrypted format');
}

function aesDecrypt(key: Buffer, ivHex: string, tagHex: string, ctHex: string): string {
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ct = Buffer.from(ctHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ct).toString('utf8') + decipher.final('utf8');
}

/** Extract key version from a stored ciphertext (for migration). */
export function getCiphertextVersion(packed: string): string {
  const parts = packed.split(':');
  if (parts.length === 4 && /^v\d+$/.test(parts[0])) return parts[0];
  return 'v1'; // legacy — assumed v1
}

// ─── Signed state cookies (HMAC-SHA256) ──────────────────────────────────────
//
// Для промежуточных челленджей (напр. totp_pending), где сервер кладёт в cookie
// идентификатор пользователя. Без подписи значение можно подделать (cookie
// подставляется напрямую, не только браузером) и пропустить парольный шаг.
// Формат: "{base64url(payload)}.{base64url(hmac)}".

function cookieSecret(): Buffer {
  const explicit = process.env.AUTH_COOKIE_SECRET;
  if (explicit) return Buffer.from(explicit, 'utf8');
  // Fallback: детерминированно выводим из TOTP-ключа (он обязателен и 32 байта).
  const base = process.env.TOTP_ENCRYPTION_KEY || process.env.TOTP_ENCRYPTION_KEYS || '';
  if (!base) {
    throw new Error('AUTH_COOKIE_SECRET or TOTP_ENCRYPTION_KEY required to sign auth cookies');
  }
  return crypto.createHash('sha256').update('auth-cookie:' + base).digest();
}

export function signState(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', cookieSecret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verifyState<T>(token: string): T | null {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', cookieSecret()).update(body).digest('base64url');
  const macBuf = Buffer.from(mac);
  const expBuf = Buffer.from(expected);
  if (macBuf.length !== expBuf.length || !crypto.timingSafeEqual(macBuf, expBuf)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

// ─── Timing-safe comparison ──────────────────────────────────────────────────

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
