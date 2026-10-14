# ADR-0004: Pengambilan QR cukup dengan NIM (risiko diterima pemilik proyek)

- **Status:** Diterima — **risiko diterima secara sadar oleh pemilik proyek**
- **Tanggal:** 14 Oktober 2026

## Konteks

Wisudawan mengambil QR kehadirannya sendiri dengan mencari NIM di halaman utama (ADR-0003). Data dari BAAK hanya berisi `ANGKATAN`, `NIM`, `NAMA`, `PROGRAM STUDI`, `TANGGAL LULUS` — tidak ada data rahasia (tanggal lahir, email, nomor HP) yang bisa dipakai untuk verifikasi kedua. NIM terdiri atas 11 digit berpola dan mudah ditebak.

Opsi yang dipertimbangkan: (A) NIM + tanggal lahir, (B) NIM + kode unik dari panitia, (C) NIM saja + pembatasan.

## Keputusan

**Opsi C: NIM saja**, dengan mitigasi wajib berikut:

1. **QR berisi token yang ditandatangani server**, bukan NIM polos — tidak bisa dipalsukan atau dibuat sendiri.
2. **Rate limiting** pada pencarian NIM (per IP), ditambah deteksi pola pencarian berurutan.
3. **Data yang ditampilkan minimal**: hanya yang diperlukan wisudawan untuk memastikan datanya benar (detail *Pending* — mis. nama, prodi).
4. **Layar pemindai menampilkan nama dan prodi** pemilik QR agar petugas dapat mencocokkannya dengan orangnya.
5. Pemindaian kedua untuk QR yang sama di sesi yang sama ditandai sebagai duplikat, bukan dicatat ulang.
6. Data wisudawan dihapus atau dianonimkan setelah masa retensi yang disepakati (*Pending*).

## Risiko yang diterima

| Risiko | Dampak | Sisa mitigasi |
|---|---|---|
| Orang lain mengunduh QR wisudawan dengan menebak NIM | Kehadiran gladi bisa "dititipkan" | Petugas mencocokkan nama di layar pemindai dengan orangnya (butuh kesepakatan prosedur dengan panitia) |
| Daftar wisudawan (nama, prodi) dikumpulkan dengan skrip | Paparan data pribadi | Rate limiting, data tampil minimal |

## Alternatif yang ditolak

- **NIM + tanggal lahir** — butuh kolom tambahan dari BAAK; pemilik proyek memilih tanpa data tambahan.
- **NIM + kode unik** — menambah beban distribusi bagi panitia.

## Konsekuensi

- Dapat ditingkatkan ke opsi A tanpa mengubah format QR, cukup dengan menambah kolom pada data import dan satu field pada form pencarian.
- Prosedur pencocokan identitas oleh petugas harus dimasukkan ke SOP hari-H.
