-- ============================================================
-- Migration 006: email_queue, scoped sessions, TOTP key versioning
-- ============================================================

-- Scoped sessions (totp_setup flow — session issued after invite set-password)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scope TEXT[] NOT NULL DEFAULT '{}';

-- TOTP encryption key version (multi-key rotation support)
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret_key_version VARCHAR(10);

-- Mark existing encrypted secrets as version v1 (legacy single-key)
UPDATE users SET totp_secret_key_version = 'v1'
WHERE totp_secret_encrypted IS NOT NULL AND totp_secret_key_version IS NULL;

-- Track when a doctor skipped TOTP setup (optional TOTP for doctors)
ALTER TABLE users ADD COLUMN IF NOT EXISTS skipped_totp_at TIMESTAMPTZ;

-- ============================================================
-- email_queue  — persistent outbox with retry
-- ============================================================
CREATE TABLE IF NOT EXISTS email_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template        VARCHAR(50) NOT NULL,
  to_email        VARCHAR(320) NOT NULL,
  vars            JSONB NOT NULL DEFAULT '{}',
  status          VARCHAR(10) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'failed')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_pending
  ON email_queue(status, next_attempt_at)
  WHERE status = 'pending';
