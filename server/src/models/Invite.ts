import { db } from '../config/database';
import { generateToken, sha256 } from '../services/crypto.service';

export interface InviteRow {
  id: string;
  token_hash: string;
  email: string;
  role: 'admin' | 'doctor';
  expires_at: Date;
  used_at: Date | null;
  created_by: string;
  created_at: Date;
}

const TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

export interface NewInvite {
  rawToken: string;   // sent to user
  row: InviteRow;     // stored in DB
}

export async function createInvite(
  email: string,
  role: 'admin' | 'doctor',
  createdBy: string
): Promise<NewInvite> {
  const rawToken = generateToken(32);
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + TTL_MS);

  const row = await db.one<InviteRow>(
    `INSERT INTO invites (token_hash, email, role, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [tokenHash, email.toLowerCase().trim(), role, expiresAt, createdBy]
  );

  return { rawToken, row };
}

export async function findByToken(rawToken: string): Promise<InviteRow | null> {
  const tokenHash = sha256(rawToken);
  return db.oneOrNone<InviteRow>(
    `SELECT * FROM invites
     WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > NOW()`,
    [tokenHash]
  );
}

export async function markUsed(inviteId: string): Promise<void> {
  await db.none(
    'UPDATE invites SET used_at = NOW() WHERE id = $1',
    [inviteId]
  );
}

export async function listInvites(createdBy?: string): Promise<InviteRow[]> {
  if (createdBy) {
    return db.manyOrNone<InviteRow>(
      'SELECT * FROM invites WHERE created_by = $1 ORDER BY created_at DESC',
      [createdBy]
    );
  }
  return db.manyOrNone<InviteRow>('SELECT * FROM invites ORDER BY created_at DESC');
}
