/**
 * Email service with persistent queue and exponential back-off retry.
 *
 * Queue backend: PostgreSQL email_queue table.
 * Rate limit:    1 message of same template per user per 5 minutes (via rate_limits table).
 * Security:      templates never emit session_id, tokens, passwords, ADMIN_PATH_SECRET.
 */

import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import { db } from '../config/database';
import { renderTemplate, TemplateName } from './emailTemplates';
import { logAudit } from '../models/AuthAudit';

// ─── Config ──────────────────────────────────────────────────────────────────

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
  from: string;
}

function getSmtpConfig(): SmtpConfig | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) return null;
  return {
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT ?? '465', 10),
    secure: SMTP_SECURE !== 'false',
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    from: SMTP_FROM,
  };
}

let _transporter: Mail | null = null;

function getTransporter(): Mail | null {
  if (_transporter) return _transporter;
  const cfg = getSmtpConfig();
  if (!cfg) return null;
  _transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
  });
  return _transporter;
}

/** Verify SMTP connection on startup. Always warn-only — server runs without email. */
export async function verifySmtp(): Promise<void> {
  const cfg = getSmtpConfig();
  if (!cfg) {
    console.warn('⚠️  SMTP not configured (SMTP_HOST/USER/PASSWORD/FROM missing) — emails will not be sent');
    return;
  }

  const transport = getTransporter()!;
  try {
    await (transport as any).verify();
    console.log(`✅ SMTP connected to ${cfg.host}:${cfg.port}`);
  } catch (err: any) {
    console.warn(`⚠️  SMTP verify failed: ${err.message} — emails will not be sent`);
  }
}

// ─── Rate limit for emails ────────────────────────────────────────────────────

const EMAIL_RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

async function isEmailRateLimited(userId: string | null, template: string): Promise<boolean> {
  if (!userId) return false;
  const key = `email:${userId}:${template}`;
  const row = await db.oneOrNone<{ last_sent: Date }>(
    `SELECT sent_at AS last_sent FROM email_queue
     WHERE to_email = (SELECT email FROM users WHERE id = $1)
       AND template = $2
       AND status = 'sent'
       AND sent_at > NOW() - INTERVAL '5 minutes'
     LIMIT 1`,
    [userId, template]
  );
  return !!row;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Enqueue an email for delivery.
 * Returns immediately — delivery is async via the queue worker.
 */
export async function sendEmail(
  template: TemplateName,
  to: string,
  vars: Record<string, string>,
  options?: { userId?: string | null; skipRateLimit?: boolean }
): Promise<void> {
  const userId = options?.userId ?? null;

  if (!options?.skipRateLimit && await isEmailRateLimited(userId, template)) {
    console.log(`[mailer] Rate limited: ${template} to ${to}`);
    return;
  }

  await db.none(
    `INSERT INTO email_queue (template, to_email, vars)
     VALUES ($1, $2, $3)`,
    [template, to.toLowerCase(), JSON.stringify(vars)]
  );
}

// ─── Queue worker ─────────────────────────────────────────────────────────────

function backoffSeconds(attempts: number): number {
  // 1→30s, 2→60s, 3→2min, 4→4min, 5→5min
  return Math.min(30 * Math.pow(2, attempts - 1), 5 * 60);
}

async function processQueue(): Promise<void> {
  const transport = getTransporter();
  if (!transport) return; // SMTP not configured

  const cfg = getSmtpConfig()!;

  const pending = await db.manyOrNone<{
    id: string;
    template: string;
    to_email: string;
    vars: Record<string, string>;
    attempts: number;
  }>(
    `SELECT id, template, to_email, vars, attempts FROM email_queue
     WHERE status = 'pending'
       AND next_attempt_at <= NOW()
       AND attempts < max_attempts
     ORDER BY created_at
     LIMIT 20
     FOR UPDATE SKIP LOCKED`
  );

  for (const job of pending) {
    try {
      const rendered = renderTemplate(job.template as TemplateName, job.vars);

      await transport.sendMail({
        from: cfg.from,
        to: job.to_email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });

      await db.none(
        `UPDATE email_queue SET status = 'sent', sent_at = NOW(), attempts = attempts + 1
         WHERE id = $1`,
        [job.id]
      );

      // Log success (no body logged)
      await logAudit({
        eventType: 'email_sent',
        email: job.to_email,
        details: { template: job.template },
      } as any);

    } catch (err: any) {
      const nextAttempts = job.attempts + 1;
      const maxAttempts = 5;
      const isFinal = nextAttempts >= maxAttempts;
      const nextAt = new Date(Date.now() + backoffSeconds(nextAttempts) * 1000);

      await db.none(
        `UPDATE email_queue
         SET attempts = $1,
             status = CASE WHEN $2 THEN 'failed' ELSE 'pending' END,
             next_attempt_at = $3,
             error = $4
         WHERE id = $5`,
        [nextAttempts, isFinal, nextAt, err.message?.substring(0, 500), job.id]
      );

      await logAudit({
        eventType: 'email_failed',
        email: job.to_email,
        details: { template: job.template, attempt: nextAttempts },
      } as any);
    }
  }
}

let _workerInterval: ReturnType<typeof setInterval> | null = null;

/** Start the background queue processor. Call once on server startup. */
export function startMailWorker(): void {
  if (_workerInterval) return;
  _workerInterval = setInterval(() => {
    processQueue().catch((err) => console.error('[mailer] Queue error:', err.message));
  }, 30_000); // every 30 seconds
  _workerInterval.unref(); // don't block process exit
  console.log('[mailer] Queue worker started (30s interval)');
}

/** For testing: process queue once immediately. */
export async function flushMailQueue(): Promise<void> {
  await processQueue();
}
