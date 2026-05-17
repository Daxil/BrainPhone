-- Migration 007: add case-flow columns + case_consents table
-- Covers columns from migrate_v2.ts that were never part of SQL migrations,
-- plus protocol/diagnostic columns that migration 001 omitted but setupDatabase.ts had.

-- ── patients: protocol / diagnostic columns (present in setupDatabase.ts, absent in 001) ──
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS protocol_type      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS parkinsonism_stage VARCHAR(100),
  ADD COLUMN IF NOT EXISTS comorbidities      TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis          TEXT,
  ADD COLUMN IF NOT EXISTS moca_score         VARCHAR(50);

-- ── patients: case-flow columns ──────────────────────────────────────────────
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS case_status     VARCHAR(50)              DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS case_number     VARCHAR(10),
  ADD COLUMN IF NOT EXISTS rejection_code  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS rejection_note  TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at    TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS reviewed_at     TIMESTAMP WITH TIME ZONE;

-- ── patients: extended anamnesis columns ─────────────────────────────────────
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS native_language   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS has_parkinsonism  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_cognitive     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cog_motor_test    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cog_motor_score   VARCHAR(20);

-- ── Case number sequence ──────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS case_number_seq START 1;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_patients_case_status    ON patients(case_status);
CREATE INDEX IF NOT EXISTS idx_patients_created_by_date ON patients(created_by, created_at DESC);

-- ── case_consents ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_consents (
  id            SERIAL PRIMARY KEY,
  patient_id    VARCHAR(50)  NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id     VARCHAR(50)  NOT NULL,
  consent_hash  VARCHAR(64)  NOT NULL,
  text_version  VARCHAR(64)  NOT NULL,
  check1        BOOLEAN      NOT NULL DEFAULT FALSE,
  check2        BOOLEAN      NOT NULL DEFAULT FALSE,
  signature_url VARCHAR(500),
  signed_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_consents_patient ON case_consents(patient_id);

-- ── patient_photos: category column ──────────────────────────────────────────
ALTER TABLE patient_photos
  ADD COLUMN IF NOT EXISTS photo_category VARCHAR(50) DEFAULT 'consult';
