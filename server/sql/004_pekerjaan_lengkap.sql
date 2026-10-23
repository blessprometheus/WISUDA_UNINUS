-- Pekerjaan timeline dilengkapi (D50): tanggal mulai, tanggal selesai (menggantikan "tenggat"), deskripsi,
-- dan bukti unggahan opsional. Kolom `due_date` diganti nama menjadi `end_date`: maknanya sama (tanggal target
-- selesai; dipakai untuk menghitung keterlambatan), sehingga data lama tetap utuh.
ALTER TABLE tasks RENAME COLUMN due_date TO end_date;
ALTER TABLE tasks
  ADD COLUMN start_date DATE,
  ADD COLUMN description TEXT;
ALTER TABLE tasks
  ADD CONSTRAINT tasks_description_length CHECK (description IS NULL OR length(description) <= 2000),
  ADD CONSTRAINT tasks_date_order CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date);

-- Bukti disimpan di PostgreSQL (bukan di berkas web): ikut tercadangkan, tidak ada jalur berkas yang dapat
-- ditebak, dan tidak pernah disajikan statis. Pembatasan jenis/ukuran/jumlah ditegakkan oleh API.
CREATE TABLE task_evidence (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  filename VARCHAR(120) NOT NULL,
  mime VARCHAR(40) NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  data BYTEA NOT NULL,
  uploaded_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX task_evidence_task_idx ON task_evidence (task_id, id);
