-- Formulir verifikasi & pendaftaran mandiri wisudawan serta status kelayakan keuangan & yudisium.
ALTER TABLE students
  ADD COLUMN is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN is_yudisium BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN eligibility_note VARCHAR(500),
  ADD COLUMN registration_status VARCHAR(16) NOT NULL DEFAULT 'belum_daftar'
    CHECK (registration_status IN ('belum_daftar', 'terdaftar')),
  ADD COLUMN registered_at TIMESTAMPTZ,
  ADD COLUMN gender VARCHAR(16)
    CHECK (gender IS NULL OR gender IN ('Laki-laki', 'Perempuan')),
  ADD COLUMN toga_size VARCHAR(8)
    CHECK (toga_size IS NULL OR toga_size IN ('M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL')),
  ADD COLUMN birth_place VARCHAR(120),
  ADD COLUMN birth_date DATE,
  ADD COLUMN phone VARCHAR(30),
  ADD COLUMN email VARCHAR(160),
  ADD COLUMN gpa NUMERIC(3,2)
    CHECK (gpa IS NULL OR (gpa >= 0.00 AND gpa <= 4.00)),
  ADD COLUMN graduation_date DATE,
  ADD COLUMN thesis_title VARCHAR(500),
  ADD COLUMN photo_mime VARCHAR(24)
    CHECK (photo_mime IS NULL OR photo_mime IN ('image/jpeg', 'image/png', 'image/webp')),
  ADD COLUMN photo_bytes INTEGER
    CHECK (photo_bytes IS NULL OR (photo_bytes BETWEEN 1 AND 5242880)),
  ADD COLUMN photo_data BYTEA;

CREATE INDEX students_eligibility_idx ON students (ceremony_id, is_paid, is_yudisium, registration_status);

