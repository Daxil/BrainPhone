CREATE TABLE IF NOT EXISTS patient_photos (
  id VARCHAR(50) PRIMARY KEY,
  patient_id VARCHAR(50) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  yandex_disk_url VARCHAR(500),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_photos_patient_id ON patient_photos(patient_id);
CREATE INDEX idx_photos_uploaded_at ON patient_photos(uploaded_at DESC);
