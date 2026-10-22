-- Migration 011: разметка датасета супер-админами
--
-- dataset_annotations — значения колонок листа «Субъекты Р и С - НОВЫЕ» по кейсу.
-- Внешнего ключа на patients нет намеренно: в S3 встречаются аудио/анкеты
-- кейсов, которых уже нет в БД, и их тоже нужно размечать.

CREATE TABLE IF NOT EXISTS dataset_annotations (
  patient_id   VARCHAR(50)  PRIMARY KEY,
  data         JSONB        NOT NULL DEFAULT '{}',
  is_complete  BOOLEAN      NOT NULL DEFAULT FALSE,
  version      INTEGER      NOT NULL DEFAULT 1,
  annotated_by UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dataset_annotations_complete ON dataset_annotations(is_complete);

-- Step-up подтверждение (повторный ввод пароля / 2FA) для опасных операций
-- датасета (удаление аудио). В БД — только SHA-256 токена; токен привязан к
-- сессии и живёт несколько минут.
CREATE TABLE IF NOT EXISTS step_up_tokens (
  token_hash  VARCHAR(64)  PRIMARY KEY,
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id  VARCHAR(64)  NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  purpose     VARCHAR(40)  NOT NULL,
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_step_up_tokens_expires ON step_up_tokens(expires_at);
