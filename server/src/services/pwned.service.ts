/**
 * Password strength checks:
 *  1. Minimum 12 characters
 *  2. Local top-50 common password blocklist
 *  3. HaveIBeenPwned k-anonymity API (optional, controlled by HIBP_CHECK_ENABLED)
 */

import crypto from 'crypto';
import axios from 'axios';

// Top-50 most common passwords (expand to full top-10k in production)
const COMMON_PASSWORDS = new Set([
  'password123456', '123456789012', 'password12345', 'qwertyuiopas',
  '111111111111', '123456789101', 'iloveyou1234', 'admin12345678',
  'letmein12345', 'welcome12345', 'monkey123456', 'dragon123456',
  'master123456', 'sunshine1234', 'princess1234', 'football1234',
  'shadow123456', 'superman1234', 'michael1234', 'jessica12345',
  'passw0rd1234', 'abc123456789', 'mustang12345', 'access123456',
  'batman123456', 'baseball1234', 'dragon123456', 'trustno11234',
  'hello12345678', 'summer123456', 'charlie12345', 'donald123456',
  'password1234', '1234567890ab', 'qwerty123456', 'starwars1234',
  'Ashley123456', 'bailey123456', 'passw0rd123!', 'superman123!',
  'letmein1234!', 'welcome1234!', 'admin12345!', '12345678901!',
  '1111111111111', '22222222222', '33333333333', '12341234123',
  'abcdefghijkl', 'zyxwvutsrqpo',
]);

export interface PasswordCheckResult {
  valid: boolean;
  reason?: string;
}

export async function checkPassword(password: string): Promise<PasswordCheckResult> {
  if (password.length < 12) {
    return { valid: false, reason: 'Пароль должен содержать минимум 12 символов' };
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, reason: 'Пароль слишком распространён — выберите другой' };
  }

  if (process.env.HIBP_CHECK_ENABLED !== 'false') {
    const pwned = await isPwned(password);
    if (pwned > 0) {
      return { valid: false, reason: `Пароль найден в базе утечек (${pwned} раз) — выберите другой` };
    }
  }

  return { valid: true };
}

/** HaveIBeenPwned k-anonymity check. Returns number of known breaches (0 if clean). */
async function isPwned(password: string): Promise<number> {
  try {
    const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      timeout: 3000,
    });

    const lines: string[] = response.data.split('\r\n');
    for (const line of lines) {
      const [s, count] = line.split(':');
      if (s === suffix) return parseInt(count, 10);
    }
    return 0;
  } catch {
    // Network failure or API unavailable — fail open (don't block user)
    return 0;
  }
}
