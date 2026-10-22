-- Hari-H punya dua sesi (pagi dan siang) pada tanggal yang sama, jadi batas "satu sesi per tanggal" dilonggarkan.
-- Pengganti: nama sesi unik per tanggal (tanpa membedakan huruf besar/kecil). Jam yang bertabrakan dicegah di aplikasi.
-- Aturan "hanya satu sesi aktif" (attendance_sessions_one_active_idx) tidak berubah.
ALTER TABLE attendance_sessions DROP CONSTRAINT attendance_sessions_one_per_date;
CREATE UNIQUE INDEX attendance_sessions_name_per_date_idx
  ON attendance_sessions (ceremony_id, event_date, LOWER(name));
