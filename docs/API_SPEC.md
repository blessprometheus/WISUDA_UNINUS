# API Spec (R2)

> **Status: DRAFT usulan — belum disetujui.** Tanggal: 15 Oktober 2026.
> Backend: Fastify (ADR-0009), satu domain dengan frontend; Nginx meneruskan `/api/*` ke `127.0.0.1:3001`.
> Hubungan ke tabel: [DATABASE_DESIGN.md](DATABASE_DESIGN.md).

## Konvensi

- Prefiks `/api/v1`. Respons: `{ "success": true, "data": … }` atau `{ "success": false, "message": "…" }` (pesan berbahasa Indonesia).
- Autentikasi: cookie sesi `httpOnly` (+ `secure`, `sameSite=lax`); semua `POST/PUT/PATCH/DELETE` memerlukan **token CSRF** (cookie + header + cek `Origin`), seperti PKKMB.
- Validasi masukan di setiap endpoint (skema); semua query SQL berparameter; `Cache-Control: private, no-store`.
- Peran: **S** = superadmin, **P** = petugas, **K** = koordinator, **T** = ketua, **—** = publik. Pemeriksaan peran di server.
- Rate limit (usulan awal, dikalibrasi lewat uji beban): login 5/menit/IP + penguncian per akun; pencarian NIM 120/menit/IP; unduhan QR 240/menit/IP; impor 10 per 10 menit.

## Endpoint

### Publik

| Metode | Rute | Peran | Fungsi |
|---|---|---|---|
| POST | `/lookup` | — | Cari NIM → data minimal (nama, prodi) + URL unduh QR bertanda tangan 15 menit (ADR-0004) |
| GET | `/download/qr/:id?expires&signature` | — | PNG QR (token acak, bukan NIM) |
| GET | `/healthz` | — | Cek hidup + koneksi database |

### Autentikasi

| Metode | Rute | Peran | Fungsi |
|---|---|---|---|
| GET | `/sanctum/csrf-cookie` | — | Terbitkan cookie CSRF |
| POST | `/auth/login` | — | Email + password; langsung membuat sesi penuh (tanpa 2FA, D40) |
| GET | `/auth/me` | semua | Profil sesi |
| POST | `/auth/logout` | semua | Cabut sesi |

### Aturan pemindaian (D26, diimplementasikan 15 Okt 2026)

- Sesi harus **diaktifkan superadmin** ("membuka gerbang"); selain itu hasil `not_active`.
- **Scan QR** hanya di dalam jendela waktu sesi; di luar → `outside_window` (tidak dicatat).
- **Input NIM manual** diterima di luar jendela tetapi `outside_window = true` di rekap.
- Hasil scan (HTTP 200): `recorded`, `duplicate`, `unknown`, `not_active`, `outside_window`, `inactive_student`; berisi nama dan prodi untuk dikonfirmasi petugas.
- Scan ganda (termasuk dari 4 titik bersamaan) ditegakkan constraint `UNIQUE(student_id, session_id)`.
- Impor: kirim isi berkas dengan `Content-Type: text/csv` (header `X-Filename` opsional); `?dry_run=1` untuk pratinjau.
- Peninjauan entri tidak terdaftar: `POST /admin/unregistered/:id/review`. Anonimisasi butuh `confirm: "ANONIMKAN WISUDA 70"`.

### Kehadiran

| Metode | Rute | Peran | Fungsi |
|---|---|---|---|
| GET | `/scan/context` | S,P | Sesi + jam server |
| POST | `/scan` | S,P | Catat kehadiran dari token QR |
| POST | `/scan/manual` | S,P | Catat kehadiran dari NIM (cadangan) |
| POST | `/scan/unregistered` | S,P | Catat entri "tidak terdaftar" (D17) |
| GET | `/scan/recent` | S,P | Scan terakhir sesi |
| GET/POST/PUT | `/admin/attendance-sessions` | S | Daftar/buat/ubah sesi |
| POST | `/admin/attendance-sessions/:id/activate` | S | Aktifkan sesi |
| GET | `/admin/dashboard/stats` | S | Hadir/belum per prodi, tren 10 menit |
| GET | `/admin/attendances` , `/admin/attendances/export` | S | Daftar + ekspor CSV (anti formula injection) |
| GET | `/admin/unregistered` + PATCH `/:id/review` | S | Tinjau entri tidak terdaftar |

### Data wisudawan

| Metode | Rute | Peran | Fungsi |
|---|---|---|---|
| POST | `/admin/students/import` | S | Impor **CSV UTF-8** (D20): pratinjau + laporan galat/NIM ganda; idempoten |
| GET | `/admin/students` | S | Cari/daftar |
| POST | `/admin/students` | S | Tambah satu wisudawan |
| PUT | `/admin/students/:id` | S | Ubah |
| POST | `/admin/students/:id/deactivate` | S | Nonaktifkan |
| GET | `/admin/import-batches` | S | Riwayat impor |
| POST | `/admin/retention/anonymize` | S | Anonimisasi per penyelenggaraan (setelah BAAK menetapkan retensi) |

### Pengguna (diimplementasikan 15 Okt 2026)

| Metode | Rute | Peran | Fungsi |
|---|---|---|---|
| GET / POST | `/admin/users` | S | Daftar / buat akun (kata sandi sementara acak, **tampil sekali**) |
| POST | `/admin/users/:id/deactivate` , `/reactivate` | S | Nonaktifkan (mencabut sesi) / aktifkan. Tidak boleh menonaktifkan diri sendiri atau superadmin aktif terakhir |
| POST | `/admin/users/:id/revoke-sessions` , `/reset-password` | S | Cabut semua sesi / sandi sementara baru (mencabut sesi) |
| GET | `/admin/audit-log` | S | Log audit berpaginasi |

Akses darurat superadmin yang lupa kata sandi: `npm run admin:reset-password -- --email ...` (dijalankan di server oleh pemilik proyek; sandi acak tampil sekali, semua sesi dicabut).

### Timeline (diimplementasikan 15 Okt 2026)

| Metode | Rute | Peran | Fungsi |
|---|---|---|---|
| GET | `/timeline/divisions` | K, T, S (semua divisi; `mine` = boleh diubah, D46) | Daftar divisi |
| GET | `/timeline/tasks?division_id` | K (divisi mana pun, hanya lihat), T, S | Daftar pekerjaan (judul, status, tanggal mulai/selesai, deskripsi, jumlah catatan dan bukti) |
| POST/PUT | `/timeline/tasks` , `/timeline/tasks/:id` | K (divisi miliknya), S | Buat/ubah pekerjaan: `title`, `status`, `start_date`, `end_date`, `description` (tanggal dan deskripsi opsional; selesai ≥ mulai) |
| POST | `/timeline/tasks/:id/notes` | K (miliknya), S | Tambah catatan progres |
| GET | `/timeline/tasks/:id/evidence` | K (miliknya), T, S | Daftar bukti (tanpa isi berkas) |
| POST | `/timeline/tasks/:id/evidence` | K (miliknya), S | Unggah bukti: isi mentah `image/jpeg`, `image/png`, `image/webp`, atau `application/pdf` (≤ 5 MB, maks. 5 per pekerjaan), nama di header `X-Filename`; jenis dari isi berkas (ADR-0012) |
| GET | `/timeline/evidence/:evidenceId` | K (miliknya), T, S | Buka/unduh bukti (gambar inline, PDF attachment; CSP sandbox, nosniff) |
| POST | `/timeline/evidence/:evidenceId/delete` | K (miliknya), S | Hapus bukti |
| GET | `/timeline/report` | K, T, S | Beranda: ringkasan progres semua divisi; isi catatan terbaru milik divisi sendiri untuk K (D46) |

**K dan T tidak dapat memanggil endpoint `/admin/*`, `/scan/*`, atau `/lookup` data wisudawan** — diuji otomatis (tes otorisasi per peran).

## Tes wajib sebelum staging

Otorisasi per peran (matriks di atas), CSRF, rate limit, pencegahan scan ganda paralel, impor idempoten (token stabil), impor NIM ganda, penguncian akun, ekspor anti formula injection.


### Timeline — rute yang berlaku

| Metode | Rute | Peran |
|---|---|---|
| GET | `/timeline/divisions` | S, T, K (semua divisi; K melihat penanda `mine` untuk divisinya) |
| GET | `/timeline/tasks?division_id` | S, T, K (semua divisi, hanya lihat untuk K di divisi lain) |
| GET | `/timeline/tasks/:id/notes` | S, T; K (hanya divisinya) |
| POST / PUT | `/timeline/tasks` , `/timeline/tasks/:id` , `POST /timeline/tasks/:id/notes` | S; K (divisinya). **T tidak boleh menulis** |
| POST | `/timeline/tasks/:id/delete` | S |
| GET | `/timeline/report` | S, T, K (K: catatan terbaru hanya divisinya) |
| GET / POST | `/admin/divisions` , `/admin/divisions/:id/members` , `.../members/:userId/remove` | S (hanya pengguna berperan koordinator yang dapat ditugaskan; satu divisi boleh beberapa koordinator) |

Koordinator yang mengakses divisi lain mendapat 403. Pemisahan ini diuji otomatis (termasuk perusakan sengaja pada pengaman isolasi dan peran ketua).
