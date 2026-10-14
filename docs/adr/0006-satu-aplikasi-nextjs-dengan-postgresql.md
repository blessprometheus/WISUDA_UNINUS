# ADR-0006: R2 sebagai satu aplikasi Next.js dengan PostgreSQL, tanpa Fastify terpisah

- **Status:** Diterima sebagian — **poin "tanpa Fastify terpisah" diganti oleh [ADR-0009](0009-adaptasi-backend-pkkmb.md)**; PostgreSQL, tanpa monorepo, migration, dan backup tetap berlaku (ketersediaan PostgreSQL di server ini *Pending* konfirmasi)
- **Tanggal:** 14 Oktober 2026
- **Menindaklanjuti:** ADR-0001 (keputusan backend/DB ditunda ke R2)

## Konteks

Kebutuhan R2 yang pasti (ADR-0003 s.d. ADR-0005): tabel wisudawan (± 1.400 baris), sesi kehadiran, catatan kehadiran; login admin dan 4 petugas; import Excel; pencarian NIM; pembuatan QR; halaman pemindai; rekap dan ekspor. Beban puncak kecil (4 titik scan bersamaan, lonjakan unduhan QR menjelang gladi). Server aaPanel dikelola satu orang. Pemilik proyek menyebut proyek PKKMB sebelumnya memakai PostgreSQL.

## Keputusan

1. **Satu aplikasi Next.js**: Route Handlers dan Server Actions sebagai lapisan backend. **Tidak ada Fastify terpisah.**
2. **PostgreSQL** sebagai database. Bila ternyata tidak tersedia di server ini, fallback ke MySQL/MariaDB (ADR baru yang meninjau ulang).
3. **ORM: Drizzle** (usulan). Dikonfirmasi saat Phase 3 setelah memeriksa rilis stabil dan kompatibilitas terbaru dengan Node 24 dan Next.js, bukan berdasarkan ingatan.
4. **Tanpa monorepo**: satu aplikasi, satu `package.json`.
5. Perubahan schema hanya lewat **migration**. Pencegahan scan ganda lewat **constraint unik** di database (ADR-0005).
6. **Backup database terjadwal** (sudah tersedia di aaPanel menurut pemilik proyek). **Uji restore** wajib dilakukan sebelum gladi.
7. Rahasia (koneksi DB, kunci sesi) hanya di environment variable server; tidak di repo.

## Alternatif yang ditolak

- **Fastify terpisah** — menambah proses, port, reverse proxy, dan CORS tanpa manfaat di skala ini. Ditinjau ulang hanya jika muncul klien lain (mis. aplikasi mobile) atau beban jauh lebih besar.
- **Monorepo** — tidak ada paket bersama yang perlu dipisah.
- **Prisma** — tidak ditolak secara prinsip; Drizzle dipilih karena lebih dekat ke SQL dan ringan. Ditinjau ulang saat setup bila ada hambatan kompatibilitas.

## Konsekuensi

- Satu deploy dan satu proses di aaPanel; runbook DEPLOYMENT.md perlu langkah migrasi database.
- Aplikasi R1 dan R2 satu codebase; R1 dirilis lebih dulu tanpa menyentuh database.
- Data pribadi hanya ada di satu database dengan satu jalur akses (aplikasi), memudahkan kontrol akses dan audit.
