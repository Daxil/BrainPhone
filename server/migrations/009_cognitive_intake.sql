-- Migration 009: cognitive screening intake (анкета, информант, GPCOG)
-- Хранится одним JSONB-документом на кейс: структура анкеты задаётся клиентом
-- и валидируется в saveCognitiveIntake, отдельные колонки не нужны.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS cognitive_intake JSONB;
