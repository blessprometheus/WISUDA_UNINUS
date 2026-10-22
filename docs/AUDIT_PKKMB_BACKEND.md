# Audit Backend PKKMB (read-only) — tahap 1

> Tanggal: 14 Oktober 2026. Tujuan: menilai kelayakan `server/` PKKMB sebagai dasar modul kehadiran Wisuda (ADR-0009).
> Repo PKKMB **tidak diubah**. Tidak ada kode yang dijalankan, tidak ada tes yang dijalankan, `npm audit` belum dijalankan.

## Cakupan yang benar-benar dibaca

`server/src/auth.ts`, `app.ts`, `config.ts`, `routes/auth.ts`, `routes/public.ts`, `lib/csv.ts`, `server/sql/001_init.sql`, bagian `routes/staff.ts` (guard, penanganan scan, impor CSV, daftar rute), `package.json`, `README.md`, awal `DEPLOYMENT.md`, serta pencarian kata kunci (2FA, trust proxy, interpolasi SQL).

**Belum dibaca:** `routes/online.ts` (akan dibuang), sisa `routes/staff.ts` (dasbor, ekspor, ubah mahasiswa, pembuatan/aktivasi sesi), migrasi 002–006, isi tes, `docs/PROJECT_GUIDE.md`, frontend.

## Temuan positif (terverifikasi di kode)

| Area | Bukti |
|---|---|
| Password | scrypt dengan salt acak, perbandingan `timingSafeEqual`, hash dummy agar waktu respons tidak membocorkan keberadaan email |
| Sesi | Token acak 32 byte, **hanya hash SHA-256 yang disimpan**, kedaluwarsa 8 jam, cookie `httpOnly`, `secure` di produksi, `sameSite=lax`, akun nonaktif langsung ditolak |
| CSRF | Cookie bertanda tangan HMAC + header + pemeriksaan `Origin`; dipakai di semua endpoint mutasi yang diperiksa |
| Otorisasi | `requireStaff` dengan daftar peran; rute admin memakai `adminOnly`; pemeriksaan di server |
| SQL | Semua nilai dari pengguna lewat parameter `$1…`; interpolasi `${}` yang ditemukan adalah potongan SQL yang dibangun kode sendiri (belum semua dibaca, lihat di atas) |
| Konfigurasi | Aplikasi gagal start bila secret < 32 karakter, kedua secret sama, atau `APP_ORIGIN` produksi bukan HTTPS |
| Rate limit | Login 5/menit, pencarian NIM 120/menit, unduhan 240/menit, impor 10 per 10 menit, tambah peserta 60/menit |
| Scan | Sisipan dengan `ON CONFLICT … DO NOTHING` + constraint unik → aman dari scan ganda bersamaan di 4 titik; log scan memakai HMAC (bukan NIM polos); kegagalan log tidak menggagalkan scan |
| Token QR | 32 heks (128 bit), acak, stabil saat impor ulang; unduhan memakai URL bertanda tangan berumur 15 menit |
| Impor | Batas 10 MB / 5.000 baris, validasi UTF-8, nama berkas dibersihkan, transaksi dengan advisory lock, laporan galat per baris, NIM ganda dalam berkas ditolak |
| Ekspor CSV | Perlindungan formula injection (`= + - @`) |
| Header/cache | `@fastify/helmet`, `Cache-Control: private, no-store` untuk API |

## Kekurangan dan risiko (terverifikasi)

| # | Temuan | Dampak | Tindakan di adaptasi |
|---|---|---|---|
| 1 | **Tidak ada 2FA** (pencarian `totp/2fa/otp` kosong) | Bertentangan dengan D19 | ~~Tambah TOTP + kode pemulihan~~ → dibangun (D27), lalu **dihapus atas keputusan pemilik proyek (D40)** |
| 2 | Pembatasan login hanya **per IP**, tanpa penguncian per akun | Tebak password terdistribusi tidak terhalang | Tambah penghitung gagal per akun + jeda bertahap |
| 3 | Peran terbatas pada `admin`/`operator`/`rekap` (CHECK di database) | Belum ada `superadmin`, `petugas`, `koordinator`, `ketua` | Migrasi peran baru; pemisahan hak akses timeline vs data wisudawan ditegakkan di server |
| 4 | **Rate limit memakai IP klien.** Bila `TRUST_PROXY=1` tidak diset di belakang Nginx, semua permintaan tampak berasal dari satu IP; bila diset, jaringan kampus bersama (NAT) tetap menyatukan banyak mahasiswa | Pencarian NIM bisa terkena 429 massal saat banyak wisudawan mengunduh QR bersamaan | Atur `TRUST_PROXY` dengan benar di aaPanel; uji beban unduhan QR; evaluasi batas 120/menit setelah uji. Catatan: PKKMB (± 1.300 mahasiswa) berjalan lancar dengan konfigurasi ini |
| 5 | Impor hanya **CSV UTF-8**; `.xlsx` ditolak dengan sengaja | Data BAAK berupa Excel | Usulan: **tetap CSV** (ekspor "CSV UTF-8" dari Excel) dengan templat; menghindari pustaka pembaca `.xlsx` yang menambah permukaan serangan |
| 6 | Kolom `faculty` wajib; `degree_level` wajib (`sarjana`/`pascasarjana`) | Data BAAK tidak punya fakultas dan jenjang | Ubah skema: fakultas opsional/dihapus; jenjang diturunkan dari awalan prodi (`S1/S2/S3`) hanya bila disetujui, atau dihapus |
| 7 | Hanya satu entri per mahasiswa **per tanggal**, satu sesi per tanggal | Cocok untuk gladi (9 Des) dan hari-H (10 Des); hari-H punya 2 sesi (pagi, siang) pada tanggal yang sama, lihat catatan di IMPLEMENTATION_PLAN D37 | Dipertahankan untuk kehadiran per mahasiswa per sesi; sejak D38 satu tanggal boleh punya beberapa sesi |
| 8 | Tidak ada entri "tidak terdaftar" (D17), penghapusan/anonimisasi data (ADR-0007), dan **log audit tindakan admin** selain `import_batches` dan `scan_logs` | Kebutuhan baru | Tambah tabel/rute |
| 9 | Nama, cookie, teks, dan nama berkas masih bertema PKKMB (`pkkmb_session`, `PKKMB-UNINUS-2026-…`) | Kebingungan, kemungkinan bentrok cookie | Ganti nama saat adaptasi |
| 10 | `SESSION_SECRET` dipakai untuk CSRF dan HMAC log scan sekaligus | Risiko rendah (satu rahasia, banyak fungsi) | Pisahkan menjadi rahasia terpisah |
| 11 | Pembersihan sesi kedaluwarsa tidak terlihat; ganti password / cabut sesi lain belum terlihat | Sesi lama menumpuk, pencabutan akses petugas setelah hari-H harus manual | Tambah pembersihan berkala dan "cabut semua sesi pengguna" |

## Kesimpulan tahap 1

Fondasi **layak diadaptasi**: otentikasi, CSRF, penanganan scan, impor, dan validasi konfigurasi dibuat dengan hati-hati dan konsisten, dan sistemnya sudah terbukti di acara nyata. Yang perlu ditambahkan (2FA, peran baru, penguncian per akun, "tidak terdaftar", retensi, log audit) bersifat penambahan, bukan perbaikan celah besar. **Belum ada temuan yang menghalangi adaptasi**, dengan catatan bagian yang belum dibaca akan diaudit sebelum dipakai.

## Tahap 2 — temuan tambahan (15 Okt 2026, `routes/staff.ts` baris 414–980)

| # | Temuan | Dampak untuk Wisuda |
|---|---|---|
| 12 | **Scan dan input manual sama-sama ditolak di luar jendela waktu sesi** (`is_open_now` → `session_closed`) | Jebakan operasional: jika jam sesi salah diatur, cadangan manual pun mati. Jendela waktu gladi/hari-H harus diatur longgar dan dapat diubah superadmin tanpa deploy |
| 13 | ~~Satu sesi per tanggal (UNIQUE `event_date`)~~ **diganti D38:** nama unik per tanggal + jam tidak beririsan; sesi tidak bisa diubah setelah ada kehadiran, aktivasi lewat advisory lock + indeks unik "satu sesi aktif" | Cocok: gladi (9 Des) satu sesi, hari-H (10 Des) dua sesi (pagi, siang) setelah migrasi 002 (D38) |
| 14 | Impor memakai `ON CONFLICT (nim) DO UPDATE` yang **tidak menyentuh `attendance_token`** | Token QR stabil saat impor ulang (kebutuhan D16 terpenuhi) |
| 15 | `degree_level`, `faculty`, `attendance_mode`, `online_*`, `presenceModeSql` tersebar di impor, statistik, ekspor | Dibuang/diganti saat adaptasi; ekspor dan statistik dikelompokkan per `study_program` |
| 16 | Statistik dan ekspor memakai satu query tanpa paginasi untuk ekspor | Dapat diterima untuk ± 1.600 baris |
| 17 | Tidak ada pencatatan siapa mengubah/menambah peserta selain `import_batches` dan `scan_logs` | Tambah `audit_log` |
| 18 | Endpoint scan tidak punya rate limit sendiri (hanya login/impor/lookup/unduh) | Dapat diterima karena memerlukan sesi login; dipertimbangkan batas longgar |

**Belum dibaca:** `PUT /admin/students/:id` (baris 1122–1190), `routes/online.ts` (dibuang), migrasi 002–006 (terkait presensi daring), isi tes, `PROJECT_GUIDE.md`.

## Tahap 2 (sebelum kode dipakai di produksi)

- Baca sisa `routes/staff.ts` dan migrasi 002–006.
- Jalankan tes yang ada **di lingkungan lokal terisolasi** dan `npm audit` untuk dependensi.
- Tinjau `docs/PROJECT_GUIDE.md` (alur dan kapasitas).
- Tinjauan keamanan ulang atas kode hasil adaptasi sebelum staging.
