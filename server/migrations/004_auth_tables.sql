-- ============================================================
-- Auth tables for BrainPhone
-- gen_random_uuid() is built-in since PostgreSQL 13 (no extension needed)
-- ============================================================

-- ============================================================
-- users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(320) NOT NULL UNIQUE,
  password_hash VARCHAR(512),              -- NULL until invite used
  role          VARCHAR(20)  NOT NULL CHECK (role IN ('admin', 'doctor')),

  -- 2FA
  totp_secret_encrypted TEXT,              -- AES-256-GCM encrypted TOTP secret
  totp_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  totp_verified         BOOLEAN NOT NULL DEFAULT FALSE,
  backup_codes          TEXT[],            -- 10 argon2id hashed backup codes

  -- Session management
  session_version INTEGER NOT NULL DEFAULT 0,

  -- Brute-force protection
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================
-- sessions  (server-side; cookie stores raw token, DB stores SHA-256)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id                  VARCHAR(64) PRIMARY KEY,  -- SHA-256(raw_token) hex
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_version     INTEGER NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,      -- idle TTL (30 min, sliding)
  absolute_expires_at TIMESTAMPTZ NOT NULL,      -- hard TTL (12 h)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash             VARCHAR(64) NOT NULL,      -- SHA-256(subnet)
  ua_hash             VARCHAR(64) NOT NULL,      -- SHA-256(user-agent)
  revoked             BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id   ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ============================================================
-- invites  (token is stored hashed; TTL 48h)
-- ============================================================
CREATE TABLE IF NOT EXISTS invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash  VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256(raw_invite_token) hex
  email       VARCHAR(320) NOT NULL,
  role        VARCHAR(20)  NOT NULL CHECK (role IN ('admin', 'doctor')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);

-- ============================================================
-- auth_audit
-- ============================================================
CREATE TABLE IF NOT EXISTS auth_audit (
  id         BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(60) NOT NULL,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  email      VARCHAR(320),
  ip_address VARCHAR(45),
  user_agent TEXT,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_user_id   ON auth_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_created_at ON auth_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_event_type ON auth_audit(event_type);

-- ============================================================
-- rate_limits  (IP+email key, window-based)
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limits (
  key             VARCHAR(64) PRIMARY KEY,   -- SHA-256(ip:email) hex
  attempts        INTEGER NOT NULL DEFAULT 1,
  window_start    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until   TIMESTAMPTZ
);

-- ============================================================
-- Trigger: updated_at on users
-- ============================================================
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_users_updated_at();
