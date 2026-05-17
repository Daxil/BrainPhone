import { Request, Response } from 'express';
import {
  findByEmail,
  findById,
  verifyPassword,
  incrementFailedAttempts,
  lockAccount,
  resetFailedAttempts,
  setPasswordHash,
  hashPassword,
  setTotpSecret,
  enableTotp,
  disableTotp,
  incrementSessionVersion,
  consumeBackupCode,
} from '../models/User';
import { logAudit } from '../models/AuthAudit';
import { findByToken, markUsed } from '../models/Invite';
import {
  issueSession,
  revokeCurrentSession,
  revokeAllSessions,
  upgradeToFullSession,
} from '../services/session.service';
import { checkRateLimit, recordFailure, clearRateLimit } from '../services/rateLimit.service';
import {
  generateTotpSecret,
  decryptTotpSecret,
  generateOtpAuthUri,
  generateQrCode,
  verifyTotp,
  generateBackupCodes,
} from '../services/totp.service';
import { checkPassword } from '../services/pwned.service';
import { hashIpSubnet, hashUA } from '../services/crypto.service';
import { sendEmail } from '../services/mailer.service';
import { db } from '../config/database';
import { TOTP_ENABLED } from '../config/features';

const LOCK_THRESHOLD = 10;

function clientIp(req: Request): string {
  return req.ip || '';
}

function nowIso(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}

// ─── Login step 1: email + password ──────────────────────────────────────────

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ success: false, error: 'Email and password are required' });
    return;
  }

  const ip = clientIp(req);
  const ua = req.headers['user-agent'] || '';

  const rl = await checkRateLimit(ip, email);
  if (!rl.allowed) {
    await logAudit({ eventType: 'rate_limit_blocked', email, ipAddress: ip });
    res.status(429).json({
      success: false,
      error: 'Too many login attempts — try again later',
      retryAfterMs: rl.retryAfterMs,
    });
    return;
  }

  const user = await findByEmail(email);

  const fail = async () => {
    const attempts = await recordFailure(ip, email);
    if (user) {
      const acctAttempts = await incrementFailedAttempts(user.id);
      if (acctAttempts >= LOCK_THRESHOLD) {
        const until = new Date(Date.now() + 60 * 60 * 1000);
        await lockAccount(user.id, until);
        await logAudit({ eventType: 'account_locked', userId: user.id, email, ipAddress: ip });

        // Notify user and admin
        await sendEmail('account_locked', user.email, {
          email: user.email,
          attempts: String(acctAttempts),
        }, { userId: user.id });

        // Notify admin(s)
        const admins = await db.manyOrNone<{ email: string }>(
          "SELECT email FROM users WHERE role = 'admin'"
        );
        for (const admin of admins) {
          await sendEmail('admin_alert_lockout', admin.email, {
            target_email: user.email,
            attempts: String(acctAttempts),
            ip,
            time: nowIso(),
          }, { skipRateLimit: true });
        }
      }
    }
    await logAudit({ eventType: 'login_failure', email, ipAddress: ip, userAgent: ua });
    res.status(401).json({ success: false, error: 'Invalid email or password' });
  };

  if (!user || !user.password_hash) { await fail(); return; }

  if (user.locked_until && user.locked_until > new Date()) {
    await logAudit({ eventType: 'login_failure', userId: user.id, email, ipAddress: ip, userAgent: ua });
    res.status(423).json({ success: false, error: 'Account is temporarily locked' });
    return;
  }

  const valid = await verifyPassword(user.password_hash, password);
  if (!valid) { await fail(); return; }

  await clearRateLimit(ip, email);
  await resetFailedAttempts(user.id);

  if (TOTP_ENABLED && user.totp_enabled && user.totp_verified) {
    const pending = Buffer.from(JSON.stringify({ userId: user.id, ts: Date.now() }))
      .toString('base64url');
    res.cookie('totp_pending', pending, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 5 * 60 * 1000,
    });

    res.json({ success: true, requireTotp: true });
    return;
  }

  const ipHash = hashIpSubnet(ip);
  const uaHash = hashUA(ua);
  await issueSession(res, user.id, user.session_version, ipHash, uaHash);
  await logAudit({ eventType: 'login_success', userId: user.id, email, ipAddress: ip, userAgent: ua });

  res.json({ success: true, requireTotp: false, user: { id: user.id, email: user.email, role: user.role } });
}

// ─── Login step 2: TOTP ───────────────────────────────────────────────────────

export async function loginTotp(req: Request, res: Response): Promise<void> {
  const pending = req.cookies?.totp_pending;
  if (!pending) {
    res.status(400).json({ success: false, error: 'No pending TOTP challenge' });
    return;
  }

  let payload: { userId: string; ts: number };
  try {
    payload = JSON.parse(Buffer.from(pending, 'base64url').toString('utf8'));
  } catch {
    res.status(400).json({ success: false, error: 'Invalid TOTP challenge' });
    return;
  }

  if (Date.now() - payload.ts > 5 * 60 * 1000) {
    res.clearCookie('totp_pending', { path: '/' });
    res.status(400).json({ success: false, error: 'TOTP challenge expired' });
    return;
  }

  const user = await findById(payload.userId);
  if (!user || !user.totp_secret_encrypted) {
    res.status(401).json({ success: false, error: 'Invalid challenge' });
    return;
  }

  const { token, backupCode } = req.body;
  const ip = clientIp(req);
  const ua = req.headers['user-agent'] || '';

  let totpOk = false;

  if (typeof backupCode === 'string' && user.backup_codes?.length) {
    totpOk = await consumeBackupCode(user.id, user.backup_codes, backupCode.toUpperCase().trim());
    if (totpOk) {
      await logAudit({ eventType: 'backup_code_used', userId: user.id, ipAddress: ip });
    }
  } else if (typeof token === 'string') {
    const secret = decryptTotpSecret(user.totp_secret_encrypted);
    totpOk = verifyTotp(secret, token.trim());
  }

  if (!totpOk) {
    await logAudit({ eventType: 'login_totp_failure', userId: user.id, ipAddress: ip, userAgent: ua });
    res.status(401).json({ success: false, error: 'Invalid TOTP token' });
    return;
  }

  res.clearCookie('totp_pending', { path: '/' });
  const ipHash = hashIpSubnet(ip);
  const uaHash = hashUA(ua);
  await issueSession(res, user.id, user.session_version, ipHash, uaHash);
  await logAudit({ eventType: 'login_totp_success', userId: user.id, email: user.email, ipAddress: ip, userAgent: ua });

  res.json({ success: true, user: { id: user.id, email: user.email, role: user.role } });
}

// ─── Current user ─────────────────────────────────────────────────────────────

export async function getMe(req: Request, res: Response): Promise<void> {
  const user = await findById(req.user!.id);
  if (!user) { res.status(401).json({ success: false, error: 'User not found' }); return; }
  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      totpEnabled: user.totp_enabled,
      totpVerified: user.totp_verified,
    },
    scope: req.sessionScope ?? [],
  });
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(req: Request, res: Response): Promise<void> {
  await logAudit({ eventType: 'logout', userId: req.user?.id, ipAddress: clientIp(req) });
  await revokeCurrentSession(req, res);
  res.json({ success: true });
}

export async function logoutAll(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  await incrementSessionVersion(userId);
  await revokeAllSessions(userId, res);
  await logAudit({ eventType: 'logout_all', userId, ipAddress: clientIp(req) });
  res.json({ success: true });
}

// ─── Invite: validate token ───────────────────────────────────────────────────

export async function getInvite(req: Request, res: Response): Promise<void> {
  const { token } = req.params;
  const invite = await findByToken(token);
  if (!invite) {
    res.status(404).json({ success: false, error: 'Invite not found or expired' });
    return;
  }
  res.json({ success: true, invite: { email: invite.email, role: invite.role } });
}

// ─── Invite: set password → issue scoped session ──────────────────────────────

export async function setPassword(req: Request, res: Response): Promise<void> {
  const { token } = req.params;
  const { password } = req.body;

  if (typeof password !== 'string') {
    res.status(400).json({ success: false, error: 'Password is required' });
    return;
  }

  const invite = await findByToken(token);
  if (!invite) {
    res.status(404).json({ success: false, error: 'Invite not found or expired' });
    return;
  }

  const check = await checkPassword(password);
  if (!check.valid) {
    res.status(422).json({ success: false, error: check.reason });
    return;
  }

  const user = await findByEmail(invite.email);
  if (!user) {
    res.status(404).json({ success: false, error: 'User account not found' });
    return;
  }

  const hash = await hashPassword(password);
  await setPasswordHash(user.id, hash);
  await markUsed(invite.id);

  await logAudit({
    eventType: 'password_set',
    userId: user.id,
    email: user.email,
    ipAddress: clientIp(req),
  });

  // Notify user
  await sendEmail('password_changed', user.email, {
    email: user.email,
    time: nowIso(),
  }, { userId: user.id, skipRateLimit: true });

  const requireTotpSetup = TOTP_ENABLED && (user.role === 'admin' || user.totp_enabled);

  if (requireTotpSetup) {
    // Issue a scoped session — user MUST set up TOTP before accessing anything else
    const ip = clientIp(req);
    const ua = req.headers['user-agent'] || '';
    const ipHash = hashIpSubnet(ip);
    const uaHash = hashUA(ua);
    await issueSession(res, user.id, user.session_version, ipHash, uaHash, ['totp_setup']);

    res.json({
      success: true,
      requireTotpSetup: true,
      totpMandatory: user.role === 'admin',
      user: { id: user.id, email: user.email, role: user.role },
    });
  } else {
    // Doctor without TOTP — redirect to normal login
    res.json({
      success: true,
      requireTotpSetup: false,
      redirectToLogin: true,
    });
  }
}

// ─── TOTP setup ───────────────────────────────────────────────────────────────

export async function setupTotp(req: Request, res: Response): Promise<void> {
  const user = await findById(req.user!.id);
  if (!user) { res.status(401).json({ success: false, error: 'User not found' }); return; }

  const { secret, encrypted } = generateTotpSecret();
  await setTotpSecret(user.id, encrypted);

  const uri = generateOtpAuthUri(user.email, secret);
  const qr  = await generateQrCode(uri);

  res.json({ success: true, secret, qrCode: qr });
}

export async function verifyTotpSetup(req: Request, res: Response): Promise<void> {
  const user = await findById(req.user!.id);
  if (!user || !user.totp_secret_encrypted) {
    res.status(400).json({ success: false, error: 'TOTP setup not started' });
    return;
  }

  const { token } = req.body;
  if (typeof token !== 'string') {
    res.status(400).json({ success: false, error: 'Token required' });
    return;
  }

  const secret = decryptTotpSecret(user.totp_secret_encrypted);
  if (!verifyTotp(secret, token.trim())) {
    res.status(422).json({ success: false, error: 'Invalid token — check your authenticator' });
    return;
  }

  const { plain, hashed } = await generateBackupCodes();
  await enableTotp(user.id, hashed);
  await logAudit({ eventType: 'totp_setup', userId: user.id, ipAddress: clientIp(req) });

  // If this was a scoped session → upgrade to full session
  const isScoped = (req.sessionScope ?? []).includes('totp_setup');
  if (isScoped) {
    const ip = clientIp(req);
    const ua = req.headers['user-agent'] || '';
    await upgradeToFullSession(
      req,
      res,
      user.id,
      user.session_version,
      hashIpSubnet(ip),
      hashUA(ua)
    );
  }

  res.json({
    success: true,
    backupCodes: plain,
    sessionUpgraded: isScoped,
    user: isScoped ? { id: user.id, email: user.email, role: user.role } : undefined,
  });
}

// ─── Skip TOTP (doctors only, when totp is optional) ─────────────────────────

export async function skipTotpSetup(req: Request, res: Response): Promise<void> {
  const user = await findById(req.user!.id);
  if (!user) { res.status(401).json({ success: false, error: 'User not found' }); return; }

  if (user.role === 'admin') {
    res.status(403).json({ success: false, error: 'Admins must configure TOTP' });
    return;
  }

  const isScoped = (req.sessionScope ?? []).includes('totp_setup');
  if (!isScoped) {
    res.status(400).json({ success: false, error: 'Not in TOTP setup flow' });
    return;
  }

  // Record skip timestamp
  await db.none(
    'UPDATE users SET skipped_totp_at = NOW(), updated_at = NOW() WHERE id = $1',
    [user.id]
  );

  // Upgrade to full session
  const ip = clientIp(req);
  const ua = req.headers['user-agent'] || '';
  await upgradeToFullSession(
    req, res, user.id, user.session_version, hashIpSubnet(ip), hashUA(ua)
  );

  res.json({
    success: true,
    skipped: true,
    user: { id: user.id, email: user.email, role: user.role },
  });
}

// ─── Disable TOTP (doctors only) ──────────────────────────────────────────────

export async function disableTotpHandler(req: Request, res: Response): Promise<void> {
  const user = await findById(req.user!.id);
  if (!user) { res.status(401).json({ success: false, error: 'User not found' }); return; }

  if (user.role === 'admin') {
    res.status(403).json({ success: false, error: 'Admins cannot disable 2FA' });
    return;
  }

  const { password } = req.body;
  if (!user.password_hash || !(await verifyPassword(user.password_hash, password))) {
    res.status(401).json({ success: false, error: 'Incorrect password' });
    return;
  }

  await disableTotp(user.id);
  await logAudit({ eventType: 'totp_disabled', userId: user.id, ipAddress: clientIp(req) });
  res.json({ success: true });
}
