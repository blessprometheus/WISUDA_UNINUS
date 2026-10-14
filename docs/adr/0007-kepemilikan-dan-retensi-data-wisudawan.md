# ADR-0007: Kepemilikan dan retensi data wisudawan

- **Status:** Diterima sebagian — **periode retensi *Pending* (menunggu BAAK)**; pemberitahuan privasi tidak diadakan atas keputusan pemilik proyek
- **Tanggal:** 14 Oktober 2026

## Konteks

Sistem menyimpan NIM, nama, program studi, dan tanggal lulus ± 1.400 wisudawan (ADR-0003), sehingga tunduk pada UU PDP No. 27/2022. Pemilik proyek menyatakan: pemilik data adalah **BAAK**; universitas **tidak memiliki kebijakan privasi/data** yang dapat dirujuk; halaman pencarian NIM **tidak perlu** menampilkan pemberitahuan privasi.

## Keputusan

1. **Pemilik data dan pihak yang berwenang menyetujui penyimpanan, ekspor, dan penghapusan data: BAAK.** Permintaan akses/ekspor data dari pihak lain harus lewat BAAK.
2. **Periode retensi belum ditetapkan.** Rekomendasi pengembang: simpan data kehadiran per orang untuk periode terbatas yang ditetapkan BAAK (usulan: ≤ 1 tahun), lalu anonimkan atau hapus; simpan rekap agregat untuk arsip. Angka final berasal dari BAAK, bukan dari pengembang.
3. **Desain data harus mendukung retensi sejak awal**: setiap tabel berisi data pribadi punya penanda waktu dan relasi ke Wisuda ke-N; disediakan tugas penghapusan/anonimisasi yang dapat dijalankan manual oleh admin atas persetujuan BAAK.
4. **Arsip Wisuda ke-70 tidak memuat nama atau NIM** kecuali BAAK menyetujui secara tertulis.
5. **Tanpa pemberitahuan privasi di halaman pencarian** (keputusan pemilik proyek). Pengembang sudah menyampaikan rekomendasi sebaliknya (lihat risiko).
6. **Data asli tidak dipakai untuk development/test.** Gunakan data palsu. Data asli hanya masuk lewat fitur import di server produksi.
7. Ekspor rekap hanya untuk admin yang berwenang dan tercatat di log audit.

## Risiko yang diterima

| Risiko | Dampak | Catatan |
|---|---|---|
| Tidak ada pemberitahuan kepada wisudawan tentang tujuan dan lama penyimpanan data | UU PDP mengharuskan pengendali data memberi tahu subjek data tentang tujuan pemrosesan; ketiadaannya dapat dipersoalkan | Rekomendasi pengembang: setidaknya satu kalimat singkat di halaman pencarian. Dapat ditambahkan kapan saja tanpa mengubah desain. Disarankan pemilik proyek menyampaikan ke BAAK. |
| Tanpa kebijakan data universitas, tidak ada rujukan baku untuk retensi dan akses | Keputusan bergantung pada individu | BAAK diminta menetapkan secara tertulis |
| Data asli sempat berada di Google Sheet yang dapat dibaca publik | Paparan sebelum sistem ini ada | Pemilik proyek diminta mengubah akses ke Restricted (item terbuka) |

## Alternatif yang dipertimbangkan

- **Retensi A (hapus cepat)** dan **C (permanen)** — tidak dipilih; B direkomendasikan tetapi angka dan keputusan akhir ada di BAAK.

## Konsekuensi

- Item terbuka: BAAK menetapkan periode retensi sebelum data asli diimpor ke produksi.
- Fitur penghapusan/anonimisasi masuk ruang lingkup R2 (bagian dari dashboard admin).
