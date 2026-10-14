# ADR-0001: R1 dibangun dengan Next.js tanpa database; keputusan backend ditunda ke R2

- **Status:** Diterima — keputusan backend/DB yang ditunda di sini sudah diputuskan di [ADR-0006](0006-satu-aplikasi-nextjs-dengan-postgresql.md)
- **Tanggal:** 14 Oktober 2026

## Konteks

Preferensi awal stack: Next.js + Fastify + PostgreSQL + (Prisma/Drizzle). R1 harus launching minggu 19–25 Oktober 2026 dan hanya berisi satu halaman informatif dengan konten statis. Kebutuhan CMS untuk R2 belum dibahas, sehingga perlu tidaknya backend terpisah belum dapat dinilai. Server aaPanel dapat menjalankan Node.js.

## Keputusan

R1 dibangun sebagai **satu aplikasi Next.js (App Router) + TypeScript strict + Tailwind CSS**, dijalankan sebagai server Node (`next start`), **tanpa database dan tanpa backend terpisah**. Konten R1 disimpan sebagai data bertipe di dalam kode.

- shadcn/ui belum dipakai (tidak ada komponen interaktif kompleks di R1).
- Animasi memakai CSS; Motion hanya ditambahkan bila ada interaksi yang tidak dapat dicapai dengan CSS.
- Font di-self-host melalui `next/font`.
- Versi library dikunci saat setup berdasarkan rilis stabil terbaru yang terverifikasi.
- Pilihan Fastify, PostgreSQL, ORM (Prisma vs Drizzle), dan monorepo diputuskan di awal R2 dalam ADR terpisah.

## Alternatif yang ditolak

- **HTML statis/Astro untuk R1, Next.js untuk R2** — R1 harus ditulis ulang; dua codebase untuk satu domain.
- **Seluruh stack sejak R1** — keputusan prematur tanpa data kebutuhan CMS; menambah titik kegagalan di minggu launching.

## Konsekuensi

- Kode R1 menjadi fondasi R2 tanpa kerja terbuang.
- Bila R2 memutuskan backend terpisah, aplikasi mungkin dipindah ke struktur monorepo (mis. `apps/web`) — biaya pemindahan rendah karena R1 kecil.
- Mengubah konten R1 memerlukan deploy ulang (dapat diterima untuk masa ± 3 minggu sampai R2).
