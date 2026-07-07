import { db } from '../config/database';

export type AuditEventType =
  | 'login_success'
  | 'login_failure'
  | 'login_totp_failure'
  | 'login_totp_success'
  | 'logout'
  | 'logout_all'
  | 'password_set'
  | 'totp_setup'
  | 'totp_disabled'
  | 'totp_skipped'
  | 'backup_code_used'
  | 'account_locked'
  | 'account_unlocked'
  | 'invite_created'
  | 'invite_used'
  | 'session_rejected_ip'
  | 'session_rejected_ua'
  | 'session_rejected_version'
  | 'rate_limit_blocked'
  | 'totp_rate_limit_blocked'
  | 'email_sent'
  | 'email_failed';

export interface AuditParams {
  eventType: AuditEventType;
  userId?: string | null;
  email?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await db.none(
      `INSERT INTO auth_audit (event_type, user_id, email, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        params.eventType,
        params.userId ?? null,
        params.email ?? null,
        params.ipAddress ?? null,
        params.userAgent ?? null,
        params.details ? JSON.stringify(params.details) : null,
      ]
    );
  } catch (err) {
    console.error('Audit log error:', (err as Error).message);
  }
}
