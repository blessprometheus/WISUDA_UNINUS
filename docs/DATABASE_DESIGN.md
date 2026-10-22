# Database Design (R2)

> **Status: DRAFT usulan — belum disetujui.** Tanggal: 15 Oktober 2026.
> Dasar: ADR-0003 s.d. ADR-0009, hasil [audit backend PKKMB](AUDIT_PKKMB_BACKEND.md), skema PKKMB `001_init.sql`.
> DBMS: PostgreSQL (ADR-0006). Server: PostgreSQL ada di `/www/server/pgsql`, mendengarkan `127.0.0.1:5432`
> (terlihat 15 Okt 2026; database dan akun aplikasi **belum dibuat** — dikerjakan pemilik proyek lewat aaPanel).
> Semua perubahan skema lewat file migrasi bernomor. **Tidak ada data wisudawan asli di repo atau tes.**

## Prinsip

- Data pribadi hanya di `students` (+ `unregistered_entries`); semua tabel tersebut terhubung ke `ceremonies` agar retensi/anonimisasi dapat dijalankan per penyelenggaraan (ADR-0007).
- Pencegahan duplikasi ditegakkan **constraint database**, bukan logika aplikasi.
- Waktu disimpan `TIMESTAMPTZ`; tanggal acara `DATE` (zona WIB ditangani aplikasi).
- Hak akses ditegakkan di server berdasarkan `users.role`; koordinator/ketua tidak punya akses ke tabel data wisudawan (ADR-0008).

## Tabel

### Pengguna & sesi login

| Tabel | Kolom penting | Catatan |
|---|---|---|
| `users` | `id`, `name`, `email` (unik, huruf kecil), `password_hash` (scrypt/argon2id), `role` ∈ {`superadmin`,`petugas`,`koordinator`,`ketua`}, `is_active`, `failed_logins`, `locked_until`, `created_at` | kolom 2FA dihapus pada migrasi `003` (D40) |
| `user_sessions` | `id`, `user_id`, `token_hash` (SHA-256, unik), `expires_at`, `created_at` | token mentah hanya di cookie `httpOnly`; sesi petugas dibatasi hingga masa acara |
| `audit_log` | `id`, `user_id`, `action`, `entity`, `entity_id`, `detail` (jsonb), `ip_hash`, `created_at` | login (berhasil/gagal), impor, ubah/tambah/nonaktifkan wisudawan, ekspor, penghapusan/anonimisasi, buat/nonaktifkan akun |

### Penyelenggaraan & wisudawan

| Tabel | Kolom penting | Catatan |
|---|---|---|
| `ceremonies` | `id`, `number` (unik; 70), `title`, `ceremony_date`, `created_at` | satu baris untuk R2; penentu retensi |
| `import_batches` | `id`, `ceremony_id`, `user_id`, `original_filename`, `status`, `total_rows`, `inserted_count`, `updated_count`, `failed_count`, `error_report` (jsonb) | seperti PKKMB |
| `students` | `id`, `ceremony_id`, `nim` (UNIK per `ceremony_id`), `name`, `study_program`, `cohort_year` (angkatan), `graduation_date_text` (teks informatif, D20), `attendance_token` (CHAR(32), UNIK, acak 128-bit, **tidak berubah saat impor ulang**), `is_active`, `anonymized_at`, `import_batch_id`, `created_at`, `updated_at` | tanpa `faculty` dan `degree_level` (D20). Dalam data sementara ada NIM ganda → impor melaporkan, tidak menimpa diam-diam |

### Kehadiran

| Tabel | Kolom penting | Catatan |
|---|---|---|
| `attendance_sessions` | `id`, `ceremony_id`, `kind` ∈ {`gladi`,`hari_h`}, `name`, `event_date` (UNIK per `ceremony_id`), `starts_at`, `ends_at`, `is_active`, `created_at`, `updated_at` | indeks unik parsial "satu sesi aktif" |
| `attendances` | `id`, `student_id`, `session_id`, `user_id` (petugas), `scanned_at`, `method` ∈ {`qr`,`manual`}, `device_label` | **UNIQUE(`student_id`,`session_id`)** → scan ganda dari 4 titik aman; `ON CONFLICT DO NOTHING` |
| `unregistered_entries` | `id`, `session_id`, `user_id`, `typed_nim`, `typed_name`, `created_at`, `reviewed_at`, `reviewed_by` | D17: tidak dihitung hadir; ditinjau superadmin |
| `scan_logs` | `id`, `user_id`, `session_id`, `student_id`, `result`, `raw_input_hash` (HMAC), `created_at` | seperti PKKMB |

### Timeline (R2a, D14/D15)

| Tabel | Kolom penting | Catatan |
|---|---|---|
| `divisions` | `id`, `name` (unik) | ± 10 divisi |
| `user_divisions` | `user_id`, `division_id` | cakupan `koordinator`; `ketua` membaca semua divisi |
| `tasks` | `id`, `division_id`, `title`, `status` ∈ {`belum`,`berjalan`,`selesai`,`tertunda`}, `due_date`, `created_by`, `created_at`, `updated_at` | |
| `task_notes` | `id`, `task_id`, `author_id`, `note`, `created_at` | catatan progres (append-only) |

## Retensi (ADR-0007)

Perintah/halaman superadmin yang menjalankan, **setelah BAAK menetapkan periode**: untuk satu `ceremony_id`, kosongkan `name`/`nim`/`study_program` di `students` dan `typed_*` di `unregistered_entries` (`anonymized_at` terisi), pertahankan jumlah agregat. Dicatat di `audit_log`.

## Keputusan (D26, 15 Okt 2026)

- Tabel **`ceremonies` disetujui**.
- **Jendela waktu sesi:** scan QR mengikuti jendela; **input manual boleh di luar jendela tetapi ditandai** `attendances.outside_window = TRUE` dan terlihat di rekap.
- **Masa sesi login:** petugas 12 jam, superadmin 8 jam, koordinator/ketua 7 hari.
- 2FA dihapus (D40): kolom `totp_*`, `user_sessions.mfa_verified`, dan tabel `recovery_codes` dibuang pada migrasi `003_hapus_2fa.sql` (semua sesi dicabut saat migrasi).
