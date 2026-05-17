-- Migration 008: per-test assessment score columns
-- Replaces single cog_motor_test/score pair with columns per instrument.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS mmse_score  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS trch_score  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS updrs_score VARCHAR(50);
