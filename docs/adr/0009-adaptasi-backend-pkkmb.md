# ADR-0009: Backend kehadiran diadaptasi dari backend PKKMB (Fastify + PostgreSQL)

- **Status:** Diterima — wajib didahului audit
- **Tanggal:** 14 Oktober 2026
- **Mengubah sebagian:** [ADR-0006](0006-satu-aplikasi-nextjs-dengan-postgresql.md) (menolak Fastify terpisah)

## Konteks

ADR-0006 menolak Fastify terpisah dengan asumsi backend dibangun dari nol. Pemilik proyek kemudian menunjukkan bahwa **PKKMB UNINUS 2026 sudah menjalankan sistem kehadiran QR di acara nyata**: ± 1.300 mahasiswa, 4 bangku scan berderet, **berjalan normal dan lancar** (laporan pemilik proyek). Skala itu setara Wisuda ke-70 (± 1.500–1.600 wisudawan sementara, 4 scanner).

Hasil peninjauan read-only repo PKKMB (14 Oktober 2026), yang **baru terverifikasi pada** `package.json`, `README.md`, dan `server/sql/001_init.sql`:

- Fastify 5 + PostgreSQL (`pg`), TypeScript, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cookie`, pustaka `qrcode`.
- Migrasi SQL bertahap, trigger database untuk validasi sesi, constraint unik satu kehadiran per mahasiswa per hari, hash token sesi, `scan_logs`.
- Token QR acak yang tidak berubah saat impor ulang, input NIM manual, tambah peserta susulan, rekap dan ekspor CSV.
- Tes integrasi untuk staff, presensi daring, dan hak akses. `.env.local` tidak ikut commit.
- Pemilik proyek menyatakan berwenang atas kode tersebut.

**Audit tahap 1 selesai (14 Okt 2026):** lihat [AUDIT_PKKMB_BACKEND.md](../AUDIT_PKKMB_BACKEND.md). Kesimpulan: layak diadaptasi, tanpa temuan penghalang; tidak ada 2FA; impor hanya CSV; sisa `staff.ts`, migrasi 002–006, tes, dan `npm audit` masuk tahap 2.

## Keputusan

1. **Backend modul kehadiran Wisuda diadaptasi dari `server/` PKKMB** (Fastify + PostgreSQL), disalin ke repo ini sebagai dasar. **Repo PKKMB asli tidak diubah.**
2. **Frontend tetap Next.js** (R1 dan R2) dan memanggil API Fastify. Alur deploy: dua proses di aaPanel, detail di DEPLOYMENT.md.
3. **Audit wajib sebelum adaptasi**: `auth.ts`, `staff.ts`, `online.ts`, konfigurasi, dan dependensi — fokus autentikasi, sesi, otorisasi per peran, validasi input, rate limiting, upload, dan celah umum. Hasil audit dilaporkan ke pemilik proyek sebelum kode dipakai.
4. **Dibuang**: presensi daring + bukti foto, nametag PDF, galeri/materi/video Google Drive, `sharp`/`pdf-lib` bila tak terpakai.
5. **Disesuaikan**: skema tanpa `faculty` wajib (data BAAK tidak memilikinya); sesi gladi/hari-H; impor **CSV UTF-8** (D20; admin mengekspor dari Excel, tersedia templat; **tanpa pembaca `.xlsx`** untuk menghindari dependensi baru) dengan pratinjau, validasi, dan laporan NIM ganda; `TANGGAL LULUS` disimpan sebagai teks informatif; peran `superadmin`/`petugas` (+ `koordinator`/`ketua` untuk timeline, ADR-0008); entri "tidak terdaftar" (D17); log audit; fitur retensi (ADR-0007).
6. **Tes** ikut diadaptasi dan ditambah; tes integrasi tidak boleh menyentuh database produksi atau data asli.
7. Semua rahasia hanya di environment server. Tidak ada data mahasiswa asli di repo atau tes.

## Alternatif yang ditolak

- **Tulis ulang ke Next.js** (ADR-0006 apa adanya) — mengulang pekerjaan yang sudah terbukti dan menambah risiko bug baru di jadwal ketat.
- **Pakai PKKMB apa adanya** — tidak sesuai kebutuhan (fakultas, sesi gladi, peran timeline) dan tidak dapat diaudit sebagai kode proyek ini.

## Konsekuensi

- Dua proses Node di aaPanel (Next.js dan Fastify) dengan reverse proxy; CORS/cookie lintas-asal harus dirancang hati-hati (utamakan satu domain dengan jalur `/api`).
- Kode warisan dapat membawa utang teknis; audit dan tes adalah gerbang, bukan formalitas.
- Waktu pengerjaan kehadiran berkurang, memberi ruang bagi uji skala penuh sebelum gladi.
- Modul timeline (ADR-0008) menambah tabel dan rute di backend yang sama, dengan pemisahan hak akses yang ditegakkan di server.
