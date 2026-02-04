CREATE TABLE IF NOT EXISTS patients (
  id VARCHAR(50) PRIMARY KEY,
  patient_name VARCHAR(255) NOT NULL,
  age VARCHAR(10) NOT NULL,
  gender VARCHAR(20) NOT NULL,
  chief_complaint TEXT NOT NULL,
  notes TEXT,
  blood_pressure VARCHAR(20),
  heart_rate VARCHAR(20),
  temperature VARCHAR(20),
  audio_config JSONB,
  mds_updrs JSONB,
  moca JSONB,
  diseases JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_patients_created_at ON patients(created_at DESC);
CREATE INDEX idx_patients_patient_name ON patients(patient_name);
