// Миграция v2: добавляет case_status, case_number, таблицу consents
import { db } from '../config/database';

async function migrate() {
  console.log('Запуск миграции v2...');

  // Сквозной счётчик кейсов (N001, N002, ...)
  await db.none(`
    CREATE SEQUENCE IF NOT EXISTS case_number_seq START 1;
  `);

  // Новые колонки в patients
  await db.none(`
    ALTER TABLE patients
      ADD COLUMN IF NOT EXISTS case_status    VARCHAR(50)  DEFAULT 'DRAFT',
      ADD COLUMN IF NOT EXISTS case_number    VARCHAR(10),
      ADD COLUMN IF NOT EXISTS rejection_code VARCHAR(20),
      ADD COLUMN IF NOT EXISTS rejection_note TEXT,
      ADD COLUMN IF NOT EXISTS submitted_at   TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS reviewed_at    TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS native_language VARCHAR(100),
      ADD COLUMN IF NOT EXISTS has_parkinsonism  BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS has_cognitive     BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS cog_motor_test    VARCHAR(100),
      ADD COLUMN IF NOT EXISTS cog_motor_score   VARCHAR(20);
  `);

  // Заполняем case_number для уже существующих записей
  await db.none(`
    UPDATE patients
    SET case_number = 'N' || LPAD(nextval('case_number_seq')::text, 3, '0')
    WHERE case_number IS NULL;
  `);

  // Индекс по статусу кейса
  await db.none(`
    CREATE INDEX IF NOT EXISTS idx_patients_case_status
      ON patients(case_status);
  `);

  // Индекс по дате + created_by для статистики «сегодня»
  await db.none(`
    CREATE INDEX IF NOT EXISTS idx_patients_created_by_date
      ON patients(created_by, created_at DESC);
  `);

  // Таблица согласий пациентов
  await db.none(`
    CREATE TABLE IF NOT EXISTS case_consents (
      id             SERIAL PRIMARY KEY,
      patient_id     VARCHAR(50) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      doctor_id      VARCHAR(50) NOT NULL,
      consent_hash   VARCHAR(64) NOT NULL,
      text_version   VARCHAR(64) NOT NULL,
      check1         BOOLEAN NOT NULL DEFAULT FALSE,
      check2         BOOLEAN NOT NULL DEFAULT FALSE,
      signature_url  VARCHAR(500),
      signed_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_consents_patient
      ON case_consents(patient_id);
  `);

  // Таблица фотографий шкал (MoCA/MMSE/ТРЧ)
  await db.none(`
    ALTER TABLE patient_photos
      ADD COLUMN IF NOT EXISTS photo_category VARCHAR(50) DEFAULT 'consult';
  `);

  console.log('✅ Миграция v2 выполнена');
  process.exit(0);
}

migrate().catch((e) => {
  console.error('❌ Миграция v2 провалилась:', e.message);
  process.exit(1);
});
