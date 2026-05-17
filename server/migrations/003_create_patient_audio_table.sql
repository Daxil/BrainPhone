CREATE TABLE IF NOT EXISTS patient_audio (
  id              SERIAL PRIMARY KEY,
  patient_id      VARCHAR(50) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  recording_type  VARCHAR(100),
  recording_label VARCHAR(255) DEFAULT '',
  file_path       VARCHAR(500) NOT NULL,
  duration        FLOAT        NOT NULL DEFAULT 0,
  sample_rate     INTEGER      NOT NULL DEFAULT 48000,
  bits_per_sample INTEGER      NOT NULL DEFAULT 16,
  channels        INTEGER      NOT NULL DEFAULT 1,
  file_size       BIGINT       NOT NULL DEFAULT 0,
  status          VARCHAR(20)           DEFAULT 'completed',
  yandex_disk_url VARCHAR(500),
  uploaded_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audio_patient_id ON patient_audio(patient_id);
CREATE INDEX idx_audio_uploaded_at ON patient_audio(uploaded_at DESC);
