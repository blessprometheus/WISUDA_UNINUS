# ADR-0003: Revisi ruang lingkup — modul kehadiran QR masuk R2, CMS konten dihapus

- **Status:** Diterima
- **Tanggal:** 14 Oktober 2026
- **Merevisi:** Keputusan D1 (PRD §4)

## Konteks

D1 menetapkan MVP sebagai portal informasi + CMS konten, tanpa data pribadi wisudawan. Saat membahas siapa pengelola CMS, pemilik proyek menjelaskan bahwa kebutuhan admin yang sebenarnya adalah:

- import data mahasiswa (Excel),
- membuat jadwal (sesi) pemindaian QR,
- rekap kehadiran.

Fakta pendukung: yang di-scan hanya wisudawan; sesi yang dicatat adalah **gladi resik** dan **hari-H**; jumlah wisudawan ke-70 sekitar **1.400** (data sementara berikutnya ± **1.500**, kemungkinan **1.600**); konten portal **jarang berubah** dan **tidak butuh alur persetujuan**.

## Keputusan

1. **Modul kehadiran masuk R2** dan akan dipakai pada gladi resik dan hari-H Wisuda ke-70:
   - admin mengimpor data wisudawan dari Excel,
   - wisudawan mencari NIM di halaman utama, melihat datanya, lalu mengunduh QR (lihat ADR-0004),
   - admin membuat sesi kehadiran (gladi, hari-H),
   - petugas memindai QR di lokasi,
   - admin melihat dan mengekspor rekap kehadiran.
2. **CMS konten dihapus dari ruang lingkup.** Konten portal disimpan di kode (seperti R1) dan diubah lewat deploy.
3. **Absensi manual tetap disiapkan sebagai cadangan** pada gladi dan hari-H.
4. Login hanya untuk admin dan petugas scan, tidak untuk wisudawan.

## Alternatif yang ditolak

- **Uji coba paralel dengan absensi lama sebagai sistem utama** — tidak dipilih; sistem baru dipakai sebagai sistem utama dengan cadangan manual.
- **Menunda modul ke wisuda berikutnya** — tidak sesuai kebutuhan panitia.
- **Mempertahankan CMS konten** — tidak sebanding dengan biayanya karena konten jarang berubah.

## Konsekuensi

- Sistem kini memproses **data pribadi** (NIM, nama, program studi, tanggal lulus), sehingga tunduk pada UU PDP No. 27/2022. Dibutuhkan kebijakan retensi, kontrol akses admin, dan log audit.
- **Database wajib di R2.** Pilihan DB, ORM, dan arsitektur backend diputuskan di ADR berikutnya.
- Tenggat nyata R2 adalah **sebelum gladi resik** (tanggal *Pending*), bukan pertengahan November.
- Wajib ada **simulasi pemindaian skala penuh** sebelum gladi, serta prosedur cadangan manual yang tertulis.
- Konektivitas internet di lokasi acara menjadi risiko yang harus dinilai.
