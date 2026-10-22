-- Migration 012: роль superadmin (иерархия superadmin ⊃ admin ⊃ doctor).
-- В приглашениях (invites) роль superadmin не допускается намеренно: она
-- выдаётся только CLI-скриптом npm run role:superadmin.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('superadmin', 'admin', 'doctor'));
