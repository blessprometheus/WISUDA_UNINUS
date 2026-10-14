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
