-- ============================================
-- BrainPhone Database Schema
-- PostgreSQL / Yandex Managed Service for PostgreSQL
-- ============================================

-- Удаление таблиц если существуют (для чистой установки)
DROP TABLE IF EXISTS patient_photos;
DROP TABLE IF EXISTS patient_audio;
DROP TABLE IF EXISTS patients;

-- ============================================
-- Таблица: patients
-- ============================================
CREATE TABLE patients (
  id VARCHAR(64) PRIMARY KEY,
  patient_name VARCHAR(255) NOT NULL,
  age VARCHAR(10) NOT NULL,
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  chief_complaint TEXT NOT NULL,
  notes TEXT,
  
  -- Витальные показатели
  blood_pressure VARCHAR(50),
  heart_rate VARCHAR(50),
  temperature VARCHAR(50),
  
  -- Протокол и диагностика
  protocol_type VARCHAR(50),
  parkinsonism_stage VARCHAR(100),
  comorbidities TEXT,
  diagnosis TEXT,
  moca_score VARCHAR(50),
  
  -- Оценочные шкалы (JSON)
  mds_updrs JSONB,
  moca JSONB,
  
  -- Метаданные
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patients_created_at ON patients(created_at DESC);
CREATE INDEX idx_patients_name ON patients(patient_name);

-- ============================================
-- Таблица: patient_audio
-- ============================================
CREATE TABLE patient_audio (
  id SERIAL PRIMARY KEY,
  patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  
  -- Информация о записи
  recording_type VARCHAR(100) NOT NULL,
  recording_label VARCHAR(255),
  file_path VARCHAR(500) NOT NULL,
  
  -- Технические параметры аудио
  duration INTEGER DEFAULT 0,
  sample_rate INTEGER DEFAULT 48000,
  bits_per_sample INTEGER DEFAULT 16,
  channels INTEGER DEFAULT 1,
  file_size INTEGER,
  
  -- Статус и хранение
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'uploaded', 'failed')),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ссылка на облачное хранилище (S3/Yandex Disk)
  yandex_disk_url TEXT,
  
  -- Уникальность: один тип записи на пациента
  CONSTRAINT unique_patient_recording UNIQUE (patient_id, recording_type)
);

CREATE INDEX idx_patient_audio_patient_id ON patient_audio(patient_id);
CREATE INDEX idx_patient_audio_uploaded_at ON patient_audio(uploaded_at DESC);
CREATE INDEX idx_patient_audio_status ON patient_audio(status);

-- ============================================
-- Таблица: patient_photos
-- ============================================
CREATE TABLE patient_photos (
  id SERIAL PRIMARY KEY,
  patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  
  file_path VARCHAR(500) NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ссылка на облачное хранилище (S3)
  yandex_disk_url TEXT
);

CREATE INDEX idx_patient_photos_patient_id ON patient_photos(patient_id);
CREATE INDEX idx_patient_photos_uploaded_at ON patient_photos(uploaded_at DESC);

-- ============================================
-- Триггер для автоматического обновления updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Проверка создания таблиц
-- ============================================
SELECT 
  'patients' as table_name, COUNT(*) as row_count FROM patients
UNION ALL
SELECT 'patient_audio', COUNT(*) FROM patient_audio
UNION ALL
SELECT 'patient_photos', COUNT(*) FROM patient_photos;
