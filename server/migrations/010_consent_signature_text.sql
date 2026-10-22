-- Migration 010: подпись пациента хранится как data URL (base64 PNG), это заметно
-- длиннее 500 символов — saveConsent падал с "value too long for type character varying(500)".

ALTER TABLE case_consents
  ALTER COLUMN signature_url TYPE TEXT;
