# ADR-0002: Pemindahan domain via perubahan DNS, server lama dipertahankan sebagai cadangan

- **Status:** Diterima
- **Tanggal:** 14 Oktober 2026

## Konteks

`wisuda.uninus.ac.id` saat ini melayani situs Wisuda ke-69 (galeri, e-book, survei) dari server lain. Situs baru berjalan di server aaPanel. Rencana awal adalah menghapus domain di server lama lalu memasangnya di aaPanel. Arsip lintas tahun adalah fitur MVP, dan alumni ke-69 masih membutuhkan galeri & e-book. Pemilik proyek mengelola DNS sendiri dan dapat mengunduh seluruh file situs lama.

## Keputusan

1. Backup lengkap situs ke-69 sebelum perubahan apa pun.
2. Situs baru diuji di subdomain staging dengan HTTPS.
3. Domain dipindah dengan **mengubah record DNS**, bukan menghapus server lama. TTL diturunkan 1–2 hari sebelumnya.
4. Server lama tetap hidup **minimal 2 minggu** setelah launching sebagai jalur rollback.
5. Konten ke-69 disajikan di situs baru pada `/arsip/69`; URL lama (mis. `/galeri69.html`) diberi redirect 301 ke lokasi barunya.

Langkah operasional: [DEPLOYMENT.md §3](../DEPLOYMENT.md).

## Alternatif yang ditolak

- **Hapus situs lama lalu pasang yang baru** — tidak ada rollback; konten ke-69 hilang dari web.

## Konsekuensi

- Rollback launching cukup dengan mengembalikan record DNS.
- Perlu satu subdomain staging dan sedikit pekerjaan migrasi konten ke-69 sebelum/bersamaan dengan R1.
- Struktur URL `/arsip/<nomor>` ditetapkan sejak R1; R3 harus mengikutinya.
