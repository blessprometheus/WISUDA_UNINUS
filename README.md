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

Build mengunduh font (Plus Jakarta Sans) dari Google Fonts dan menyimpannya sebagai aset lokal,
jadi mesin build membutuhkan akses internet.

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
npm run db:test:start           # sekali; butuh PostgreSQL 17 (PG_BIN untuk lokasi lain)
npm run test:api
npm run db:test:stop
```

Superadmin wajib mengaktifkan 2FA pada login pertama (aplikasi authenticator di HP).

## Uji lokal lengkap (data rekaan)

Semua berjalan di komputer sendiri, tanpa server aaPanel. Memakai klaster PostgreSQL **terpisah** (port 55433), bukan PostgreSQL lain di komputer.

```bash
npm run db:local:start     # klaster PostgreSQL terpisah (sekali per sesi komputer)
# .env.local sudah berisi rahasia acak (diabaikan Git); contoh isi ada di .env.example
npm run db:migrate         # sekali
npm run local:seed         # 8 wisudawan REKAAN, sesi aktif hari ini, akun petugas & superadmin demo
npm run build              # membaca saklar NEXT_PUBLIC_* dari .env.local
npm run local:start        # API :3001 + situs :3000 (Ctrl+C untuk berhenti)
```

- Wisudawan: <http://localhost:3000/#kartu-qr> → NIM `20260001`…`20260008` → QR tampil.
- Petugas: <http://localhost:3000/masuk> → `petugas@demo.local` → `/pemindai` → pilih meja → arahkan scanner ke QR.
- Superadmin (`super@demo.local`) wajib mendaftarkan 2FA (aplikasi authenticator di HP).
- `local:seed` menolak berjalan di database yang bukan lokal atau namanya tidak memuat dev/demo/test. Kata sandi demo hanya tampil sekali.
