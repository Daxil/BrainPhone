import { db } from './config/database';

async function createTables() {
  try {
    console.log('Создание таблиц...');

    await db.none(`
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
        protocol_type VARCHAR(50),
        parkinsonism_stage VARCHAR(10),
        comorbidities TEXT,
        diagnosis VARCHAR(255),
        moca_score VARCHAR(10),
        audio_config JSONB,
        mds_updrs JSONB,
        moca JSONB,
        diseases JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.none(`
      CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_patients_patient_name ON patients(patient_name);
    `);

    await db.none(`
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
    `);

    await db.none(`
      CREATE INDEX IF NOT EXISTS idx_photos_patient_id ON patient_photos(patient_id);
      CREATE INDEX IF NOT EXISTS idx_photos_uploaded_at ON patient_photos(uploaded_at DESC);
    `);

    await db.none(`
      CREATE TABLE IF NOT EXISTS patient_audio (
        id VARCHAR(50) PRIMARY KEY,
        patient_id VARCHAR(50) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        recording_type VARCHAR(50) NOT NULL,
        recording_label VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size BIGINT NOT NULL,
        duration INTEGER NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        sample_rate INTEGER NOT NULL,
        bits_per_sample INTEGER NOT NULL,
        channels INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'completed',
        yandex_disk_url VARCHAR(500),
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(patient_id, recording_type)
      );
    `);

    await db.none(`
      CREATE INDEX IF NOT EXISTS idx_audio_patient_id ON patient_audio(patient_id);
      CREATE INDEX IF NOT EXISTS idx_audio_recording_type ON patient_audio(recording_type);
      CREATE INDEX IF NOT EXISTS idx_audio_uploaded_at ON patient_audio(uploaded_at DESC);
    `);

    console.log('Все таблицы успешно созданы!');
    process.exit(0);
  } catch (error: any) {
    console.error('Ошибка при создании таблиц:', error.message);
    process.exit(1);
  }
}

createTables();
