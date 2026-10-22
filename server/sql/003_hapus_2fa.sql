-- 2FA dihapus atas keputusan pemilik proyek (D40). Skema bersih dari semua sisa 2FA.
-- Semua sesi dicabut: sesi "menunggu 2FA" tidak boleh berubah menjadi sesi penuh karena migrasi ini.
DELETE FROM user_sessions;
DROP TABLE recovery_codes;
ALTER TABLE users DROP CONSTRAINT users_totp_requires_secret;
ALTER TABLE users
  DROP COLUMN totp_secret_enc,
  DROP COLUMN totp_enabled,
  DROP COLUMN totp_last_step;
ALTER TABLE user_sessions DROP COLUMN mfa_verified;
