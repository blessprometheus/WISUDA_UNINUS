# Website Wisuda UNINUS 2026 (Wisuda ke-70)

Website resmi Wisuda ke-70 Universitas Islam Nusantara (wisuda Kamis, 10 Desember 2026; gladi Rabu, 9 Desember 2026; The Trans Luxury Hotel, Bandung).

> **Status:** Phase 3 — setup project. Rilis R1 (halaman informasi) sedang disiapkan.
> Aturan kerja: [AGENTS.md](AGENTS.md). Keputusan dan rencana: [docs/](docs/IMPLEMENTATION_PLAN.md).

## Stack

Next.js (App Router) + TypeScript (strict) + Tailwind CSS. Keputusan: [ADR-0001](docs/adr/0001-r1-nextjs-tanpa-database.md).
Node.js `24.x` (sama dengan server aaPanel).

## Menjalankan

```bash
npm ci
npm run dev        # pengembangan
npm run typecheck  # pemeriksaan tipe
npm run lint
npm run build      # build produksi
npm start          # jalankan hasil build
```

Font Plus Jakarta Sans disimpan di `src/assets/fonts/` dengan lisensi OFL. Build tidak perlu
mengunduh font; mesin pengguna dan server memakai berkas font yang sama.
Build situs menggunakan webpack dan plugin PostCSS Tailwind; `npm run build` di server memakai
jalur yang sama dengan `npm run preview:build` di komputer.

## Pratinjau build production di komputer

Gunakan alur ini untuk menilai tampilan dari **build Next.js production** dan API Fastify
**terkompilasi**, seperti paket aplikasi yang akan dijalankan saat deploy. Perintah `dev` dan
`local:start` tidak diperlukan untuk pratinjau ini.

```powershell
npm ci
npm run db:local:start   # hanya bila PostgreSQL demo di komputer belum berjalan
npm run preview:build     # ulangi setelah mengubah kode atau NEXT_PUBLIC_*/API_INTERNAL_URL
npm run preview:start     # biarkan terminal terbuka; hentikan dengan Ctrl+C
```

Buka situs melalui origin yang sama persis dengan `APP_ORIGIN` di `.env.local`, misalnya
<http://127.0.0.1:3000/>. Portal staf berada di `/masuk`.
Database `wisuda_demo`, migrasi, akun, dan data rekaan perlu sudah disiapkan seperti pada
bagian **Uji lokal lengkap** di bawah. Jangan jalankan `test:api` pada database demo.

**Batas kesetaraan:** HTML, CSS, aset, dan saklar fitur memakai hasil build production yang
sama. Pratinjau komputer masih memakai HTTP dan database demo; API memakai cookie HTTP agar
login berfungsi. Deploy memakai HTTPS, cookie `Secure`, origin domain, dan data server sendiri,
sehingga alur login dan data perlu diperiksa lagi di staging HTTPS. Samakan
`NEXT_PUBLIC_QR_ENABLED`, `NEXT_PUBLIC_STAFF_ENABLED`, dan `API_INTERNAL_URL` saat build dengan
target deploy agar fitur yang terlihat sama. Port 3000 dan 3001 harus bebas sebelum
`preview:start` dijalankan.

## Struktur

- `src/content/site.ts` — konten R1 yang bertipe; nilai `null` tampil sebagai "Segera diumumkan".
  Detail acara hanya dari surat edaran panitia.
- `src/components/` — komponen halaman.
- `src/app/` — rute (`/`, `/arsip/69`) dan layout.
- `docs/` — PRD, rencana implementasi, deployment, ADR.

## Keamanan

Jangan commit `.env*` (kecuali `.env.example`), kredensial, URL panel server, atau data wisudawan.

## Backend (API) — R2

Fastify + PostgreSQL di `server/` (ADR-0009). Satu `package.json`; `server/package.json` hanya menandai modul ES.

```bash
cp .env.example .env.local      # isi rahasia acak; jangan commit
npm run db:migrate              # terapkan server/sql/*.sql
npm run admin:create -- --email nama@contoh.id --name "Nama" --role superadmin
npm run api:dev                 # API di http://127.0.0.1:3001
```

Tes memakai klaster PostgreSQL **sementara dan terpisah** (port 55433), tidak menyentuh PostgreSQL lain:

```bash
npm run db:test:start           # membutuhkan PostgreSQL 17, atau atur PG_BIN
npm run test:api
npm run db:test:stop
```

Tidak ada 2FA (dihapus, D40): semua peran masuk dengan email dan kata sandi. Kata sandi dibuat acak oleh sistem dan tampil sekali.

## Uji lokal lengkap (data rekaan)

Semua berjalan di komputer sendiri, tanpa server aaPanel. Memakai klaster PostgreSQL **terpisah** (port 55433), bukan PostgreSQL lain di komputer.

Skrip memakai PostgreSQL 17 di lokasi standar Windows. Bila instalasi berbeda, atur `PG_BIN`
di PowerShell ke folder `bin` yang sesuai dengan versi klaster:

```powershell
$env:PG_BIN = 'C:\Program Files\PostgreSQL\17\bin'
```

Gunakan database `wisuda_demo` untuk demo, terpisah dari `wisuda_test` yang skemanya dihapus oleh tes API.

```bash
npm run db:local:start     # klaster PostgreSQL terpisah (sekali per sesi komputer)
# Pastikan .env.local berisi rahasia acak dan DATABASE_URL demo; contoh ada di .env.example
npm run db:migrate         # sekali
npm run local:seed         # 8 wisudawan REKAAN, sesi aktif hari ini, akun petugas & superadmin demo
npm run build              # membaca saklar NEXT_PUBLIC_* dari .env.local
npm run local:start        # API :3001 + situs :3000 (Ctrl+C untuk berhenti)
```

- Wisudawan: <http://127.0.0.1:3000/#kartu-qr> → NIM `20260001`…`20260008` → QR tampil.
- Petugas: <http://127.0.0.1:3000/masuk> → `petugas@demo.local` → `/pemindai` → pilih meja → arahkan scanner ke QR.
- Login hanya menerima origin yang sama persis dengan `APP_ORIGIN` di `.env.local`.
  Setelah mengubah `.env.local`, hentikan server dengan Ctrl+C lalu jalankan lagi.
- Superadmin (`super@demo.local`) langsung masuk dengan email dan kata sandi (tanpa 2FA).
- `local:seed` menolak berjalan di database yang bukan lokal atau namanya tidak memuat dev/demo/test. Kata sandi demo hanya tampil sekali.
