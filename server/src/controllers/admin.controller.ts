import { Request, Response } from 'express';
import { createUser, listUsers, lockAccount, findById } from '../models/User';
import { createInvite, listInvites } from '../models/Invite';
import { logAudit } from '../models/AuthAudit';
import { revokeAllSessions } from '../services/session.service';

function clientIp(req: Request): string { return req.ip || ''; }

// POST /api/admin/invites  — create invite (user account + invite token)
export async function createInviteHandler(req: Request, res: Response): Promise<void> {
  const { email, role } = req.body;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ success: false, error: 'Email is required' });
    return;
  }
  if (!['admin', 'doctor'].includes(role)) {
    res.status(400).json({ success: false, error: 'Role must be admin or doctor' });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    res.status(400).json({ success: false, error: 'Invalid email format' });
    return;
  }

  try {
    // Create user stub (no password yet)
    const user = await createUser(normalizedEmail, role as 'admin' | 'doctor', req.user!.id);

    // Create invite token
    const { rawToken, row } = await createInvite(normalizedEmail, role as 'admin' | 'doctor', req.user!.id);

    await logAudit({
      eventType: 'invite_created',
      userId: req.user!.id,
      email: normalizedEmail,
      ipAddress: clientIp(req),
      details: { role, inviteId: row.id, newUserId: user.id },
    });

    // Return raw token to admin (display once, not stored)
    res.status(201).json({
      success: true,
      invite: {
        id: row.id,
        email: row.email,
        role: row.role,
        expiresAt: row.expires_at,
        rawToken,  // Admin MUST securely relay this to the user
      },
    });
  } catch (err: any) {
    if (err?.code === '23505') {
      // Unique violation on email
      res.status(409).json({ success: false, error: 'A user with this email already exists' });
    } else {
      throw err;
    }
  }
}

// GET /api/admin/users
export async function listUsersHandler(_req: Request, res: Response): Promise<void> {
  const users = await listUsers();
  res.json({
    success: true,
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      totpEnabled: u.totp_enabled,
      totpVerified: u.totp_verified,
      lockedUntil: u.locked_until,
      failedAttempts: u.failed_attempts,
      createdAt: u.created_at,
    })),
  });
}

// GET /api/admin/invites
export async function listInvitesHandler(_req: Request, res: Response): Promise<void> {
  const invites = await listInvites();
  res.json({ success: true, invites });
}

// POST /api/admin/users/:id/unlock
export async function unlockUserHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = await findById(id);
  if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

  await lockAccount(id, new Date(0)); // set locked_until in the past
  const { db } = await import('../config/database');
  await db.none('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [id]);

  await logAudit({ eventType: 'account_unlocked', userId: req.user!.id, details: { targetUserId: id } });
  res.json({ success: true });
}

// DELETE /api/admin/users/:id
export async function deactivateUserHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (id === req.user!.id) {
    res.status(400).json({ success: false, error: 'Cannot deactivate yourself' });
    return;
  }

  const user = await findById(id);
  if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

  // Revoke all sessions and lock indefinitely
  await revokeAllSessions(id);
  const until = new Date('2099-01-01');
  await lockAccount(id, until);

  res.json({ success: true });
}

// GET /api/admin/audit
export async function auditLogHandler(req: Request, res: Response): Promise<void> {
  const { db } = await import('../config/database');
  const { limit = 100, offset = 0, userId } = req.query;

  const rows = userId
    ? await db.manyOrNone(
        'SELECT * FROM auth_audit WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [userId, parseInt(limit as string), parseInt(offset as string)]
      )
    : await db.manyOrNone(
        'SELECT * FROM auth_audit ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [parseInt(limit as string), parseInt(offset as string)]
      );

  res.json({ success: true, logs: rows });
}
