-- Add owner reference to patients for IDOR protection
-- Existing rows get NULL (visible only to admins)
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patients_created_by ON patients(created_by);
