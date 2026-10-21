# Website Wisuda UNINUS 2026 (Wisuda ke-70)

Website resmi Wisuda ke-70 Universitas Islam Nusantara (Sabtu, 5 Desember 2026).

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

Buka <http://127.0.0.1:3000/> atau alamat LAN komputer yang sudah didaftarkan di
`DEV_ADDITIONAL_ORIGINS` untuk memeriksa halaman publik. Portal staf berada di `/masuk`.
Database `wisuda_demo`, migrasi, akun, dan data rekaan perlu sudah disiapkan seperti pada
bagian **Uji lokal lengkap** di bawah. Jangan jalankan `test:api` pada database demo.

**Batas kesetaraan:** HTML, CSS, aset, dan saklar fitur memakai hasil build production yang
sama. Pratinjau komputer masih memakai HTTP dan database demo; API memakai cookie HTTP agar
login berfungsi. Deploy memakai HTTPS, cookie `Secure`, origin domain, dan data server sendiri,
sehingga alur login dan data perlu diperiksa lagi di staging HTTPS. `REQUIRE_SUPERADMIN_2FA=0`
di `.env.local` tetap berlaku untuk pratinjau ini; default deploy mewajibkan 2FA. Samakan
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
npm run db:test:start           # memakai PostgreSQL dari PATH, atau folder PG_BIN
npm run test:api
npm run db:test:stop
```

Superadmin wajib mengaktifkan 2FA pada login pertama (aplikasi authenticator di HP).

## Uji lokal lengkap (data rekaan)

Semua berjalan di komputer sendiri, tanpa server aaPanel. Memakai klaster PostgreSQL **terpisah** (port 55433), bukan PostgreSQL lain di komputer.

Skrip memilih PostgreSQL dari `PATH`. Bila perlu memilih instalasi tertentu, atur di PowerShell:

```powershell
$env:PG_BIN = 'C:\Program Files\PostgreSQL\18\bin'
```

Versi mayor harus sama dengan `.tmp/pg-test/PG_VERSION` bila klaster sudah ada.
Perintah start memeriksa koneksi sebelum menampilkan pesan siap; kegagalan menghentikan perintah dengan kode keluar bukan nol.
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
- Pada `NODE_ENV=development` atau `test`, `APP_ORIGIN` loopback juga menerima alias
  `localhost` ↔ `127.0.0.1` dengan protokol dan port yang sama. Produksi tetap hanya menerima
  origin persis sesuai `APP_ORIGIN`. Setelah mengubah kode API atau `.env.local`, hentikan
  `local:start` dengan Ctrl+C lalu jalankan lagi. Muat ulang halaman login untuk mencoba kembali.
- Jika membuka situs melalui IP LAN, tambahkan origin lengkapnya ke `DEV_ADDITIONAL_ORIGINS`
  di `.env.local` (contoh: `http://192.168.1.20:3000`; beberapa origin dipisahkan koma), lalu
  mulai ulang `local:start`. Variabel ini hanya berlaku pada mode development/test. Gunakan
  alamat IP komputer sendiri; daftar ini tidak otomatis mengizinkan alamat LAN lain.
- Superadmin (`super@demo.local`) wajib mendaftarkan 2FA (aplikasi authenticator di HP).
- `local:seed` menolak berjalan di database yang bukan lokal atau namanya tidak memuat dev/demo/test. Kata sandi demo hanya tampil sekali.
- Jika lupa sandi `super@demo.local`, jalankan `npm run local:reset-password` di terminal lokal.
  Perintah ini hanya menerima database `wisuda_demo` lokal pada port 55433, menampilkan sandi baru,
  dan mencabut sesi lama tanpa mengubah 2FA. Simpan sandinya; seed ulang tidak mereset sandi.
  Untuk memeriksa target tanpa mengubah data: `npm run local:reset-password -- --check`.
