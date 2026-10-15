-- Skema R2 Wisuda UNINUS (docs/DATABASE_DESIGN.md). Jangan diubah setelah diterapkan: tambah migrasi baru.

-- ===== Pengguna & sesi login =====
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(160) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(12) NOT NULL CHECK (role IN ('superadmin', 'petugas', 'koordinator', 'ketua')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  totp_secret_enc TEXT,
  totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  totp_last_step BIGINT,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_totp_requires_secret CHECK (totp_enabled = FALSE OR totp_secret_enc IS NOT NULL)
);
CREATE UNIQUE INDEX users_email_lower_idx ON users (LOWER(email));

CREATE TABLE user_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  mfa_verified BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX user_sessions_expiry_idx ON user_sessions (expires_at);
CREATE INDEX user_sessions_user_idx ON user_sessions (user_id);

CREATE TABLE recovery_codes (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash CHAR(64) NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, code_hash)
);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(60) NOT NULL,
  entity VARCHAR(60),
  entity_id BIGINT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash CHAR(16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);
CREATE INDEX audit_log_user_idx ON audit_log (user_id, created_at DESC);

-- ===== Penyelenggaraan & wisudawan =====
CREATE TABLE ceremonies (
  id BIGSERIAL PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  ceremony_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO ceremonies (number, title) VALUES (70, 'Wisuda ke-70 Universitas Islam Nusantara');

CREATE TABLE import_batches (
  id BIGSERIAL PRIMARY KEY,
  ceremony_id BIGINT NOT NULL REFERENCES ceremonies(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  original_filename VARCHAR(255) NOT NULL,
  status VARCHAR(12) NOT NULL CHECK (status IN ('processing', 'done', 'failed')),
  total_rows INTEGER,
  inserted_count INTEGER,
  updated_count INTEGER,
  failed_count INTEGER,
  error_report JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE students (
  id BIGSERIAL PRIMARY KEY,
  ceremony_id BIGINT NOT NULL REFERENCES ceremonies(id),
  nim VARCHAR(30) NOT NULL,
  name VARCHAR(160) NOT NULL,
  study_program VARCHAR(160) NOT NULL,
  cohort_year SMALLINT,
  graduation_date_text VARCHAR(40),
  attendance_token CHAR(32) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  anonymized_at TIMESTAMPTZ,
  import_batch_id BIGINT REFERENCES import_batches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT students_nim_per_ceremony UNIQUE (ceremony_id, nim)
);
CREATE INDEX students_program_idx ON students (study_program);

-- ===== Kehadiran =====
CREATE TABLE attendance_sessions (
  id BIGSERIAL PRIMARY KEY,
  ceremony_id BIGINT NOT NULL REFERENCES ceremonies(id),
  kind VARCHAR(8) NOT NULL CHECK (kind IN ('gladi', 'hari_h')),
  name VARCHAR(120) NOT NULL,
  event_date DATE NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_sessions_time_order CHECK (ends_at > starts_at),
  CONSTRAINT attendance_sessions_one_per_date UNIQUE (ceremony_id, event_date)
);
CREATE UNIQUE INDEX attendance_sessions_one_active_idx
  ON attendance_sessions (is_active) WHERE is_active = TRUE;

CREATE TABLE attendances (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id),
  session_id BIGINT NOT NULL REFERENCES attendance_sessions(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method VARCHAR(8) NOT NULL CHECK (method IN ('qr', 'manual')),
  outside_window BOOLEAN NOT NULL DEFAULT FALSE,
  device_label VARCHAR(60),
  CONSTRAINT attendances_one_per_student_session UNIQUE (student_id, session_id)
);
CREATE INDEX attendances_session_time_idx ON attendances (session_id, scanned_at DESC);

CREATE TABLE unregistered_entries (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES attendance_sessions(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  typed_nim VARCHAR(30) NOT NULL,
  typed_name VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by BIGINT REFERENCES users(id)
);

CREATE TABLE scan_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  session_id BIGINT REFERENCES attendance_sessions(id),
  student_id BIGINT REFERENCES students(id),
  result VARCHAR(24) NOT NULL,
  raw_input_hash CHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX scan_logs_session_idx ON scan_logs (session_id, created_at DESC);

-- ===== Timeline pekerjaan panitia =====
CREATE TABLE divisions (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE user_divisions (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  division_id BIGINT NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, division_id)
);

CREATE TABLE tasks (
  id BIGSERIAL PRIMARY KEY,
  division_id BIGINT NOT NULL REFERENCES divisions(id),
  title VARCHAR(200) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'belum' CHECK (status IN ('belum', 'berjalan', 'selesai', 'tertunda')),
  due_date DATE,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX tasks_division_idx ON tasks (division_id, due_date);

CREATE TABLE task_notes (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id BIGINT NOT NULL REFERENCES users(id),
  note TEXT NOT NULL CHECK (length(note) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX task_notes_task_idx ON task_notes (task_id, created_at);
