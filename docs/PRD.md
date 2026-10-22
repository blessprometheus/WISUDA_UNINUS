# PRD — Website Wisuda UNINUS 2026 (Wisuda ke-70)

> **Status: DRAFT — Phase 0 (Discovery).** Bagian bertanda *Pending* belum diputuskan.
> Terakhir diperbarui: 14 Oktober 2026.

## 1. Latar belakang

**Fakta (hasil peninjauan 14 Oktober 2026):**

- `wisuda.uninus.ac.id` saat ini berupa satu halaman statis "Wisuda ke-69" dalam mode pasca-acara: ucapan terima kasih, link survei (`survei.wisuda.uninus.ac.id`), e-book PDF (Wasabi S3), galeri `galeri69.html` yang meng-embed Google Drive dan sering gagal ("Google Drive menolak akses embed"), FAQ 2 butir, link Instagram/YouTube/uninus.ac.id.
- Tidak ada arsip wisuda sebelumnya, tidak ada fitur peserta, tidak ada CMS.
- Situs PKKMB UNINUS 2026 menjadi patokan kualitas frontend. Stack-nya **belum terverifikasi** (situs di-render client-side; repo `aqmalazza/PKKMB_UNINUS_2026` private).

## 2. Tujuan

1. Menyediakan informasi resmi Wisuda ke-70 yang jelas, cepat, dan terpercaya bagi wisudawan dan keluarga.
2. Menghadirkan pengalaman visual yang seremonial, prestisius, dan *timeless* — identitas sendiri, bukan salinan PKKMB.
3. Memungkinkan panitia mengelola konten tanpa developer (mulai R2).
4. Melestarikan arsip wisuda lintas tahun, dimulai dari ke-69.

## 3. Pengguna

| Pengguna | Kebutuhan utama | Status |
|---|---|---|
| Calon wisudawan ke-70 | Jadwal, syarat, panduan, pengumuman | Asumsi wajar, belum divalidasi |
| Keluarga / tamu | Lokasi, waktu, tata tertib, live stream | Asumsi |
| Alumni / wisudawan sebelumnya | Galeri, e-book, arsip | Fakta (pola situs ke-69) |
| Panitia (admin) | Mengelola konten | Asumsi — peran belum dibahas |

## 4. Ruang lingkup — D1 **direvisi oleh D7** (14 Okt 2026, [ADR-0003](adr/0003-revisi-ruang-lingkup-modul-kehadiran.md))

D1 semula: Opsi A (portal informasi + CMS, tanpa data pribadi). **Setelah D7:** portal informasi (konten di kode, tanpa CMS) **+ modul kehadiran QR** untuk gladi resik dan hari-H.

- Tidak ada login wisudawan. Login hanya untuk admin dan petugas scan.
- Sistem kini **memproses data pribadi** wisudawan (NIM, nama, program studi, tanggal lulus) — tunduk pada UU PDP.
- Pengambilan QR cukup dengan NIM; risiko diterima pemilik proyek ([ADR-0004](adr/0004-pencarian-qr-cukup-dengan-nim.md)).
- Absensi manual tetap disiapkan sebagai cadangan.

### Modul kehadiran (R2) — fakta dari pemilik proyek
- Yang di-scan: wisudawan saja. Sesi: gladi resik dan hari-H. ± 1.400 wisudawan.
- Sumber data: Excel BAAK dengan kolom `ANGKATAN`, `NIM` (11 digit), `NAMA`, `PROGRAM STUDI`, `TANGGAL LULUS` (teks "dd Bulan yyyy"). Ditemukan NIM duplikat pada data sementara; tidak ada kolom fakultas.

### Klasifikasi fitur

| Fitur | Klasifikasi | Catatan |
|---|---|---|
| Landing page wisuda | **MVP** | R1 (versi awal), R2 (lengkap) |
| Informasi acara | **MVP** | Bersumber dari surat edaran |
| Jadwal dan lokasi | **MVP** | |
| Panduan wisudawan | **MVP** | |
| FAQ | **MVP** | |
| Pengumuman | **MVP** | Dikelola via CMS (R2) |
| Galeri dokumentasi | **MVP** | R3; strategi hosting foto *Pending* (Google Drive gagal embed) |
| E-book wisuda | **MVP** | R3 |
| Arsip wisuda sebelumnya | **MVP** | Dimulai dari ke-69 (lihat ADR-0002) |
| Dashboard admin (import data, sesi, rekap) | **MVP** | R2 (D7) |
| Content management (CMS konten) | **Out of scope** | Dihapus oleh D7; konten jarang berubah, disimpan di kode |
| Import data wisudawan dari CSV UTF-8 (ekspor dari Excel, D20) | **MVP** | R2; wajib validasi & laporan duplikat NIM; **idempoten** (upsert per NIM, token QR tidak berubah saat impor ulang); pratinjau sebelum disimpan |
| Tambah / ubah / nonaktifkan wisudawan satu per satu (superadmin) | **MVP** | Data berubah hingga ± 3 hari sebelum gladi (D16); semua perubahan masuk log audit |
| Pencarian NIM di halaman utama + unduh QR | **MVP** | R2; ADR-0004 |
| Pengelolaan sesi kehadiran (gladi, hari-H) | **MVP** | R2 |
| Pemindai untuk petugas (scanner USB di laptop, online) | **MVP** | R2; ADR-0005 |
| Mode offline / PWA | Future enhancement | Dievaluasi bila uji gladi menunjukkan jaringan bermasalah |
| Rekap & ekspor kehadiran | **MVP** | R2 |
| Prosedur absensi manual (cadangan) | **MVP** | SOP, bukan fitur perangkat lunak |
| Pengelolaan periode wisuda (Wisuda ke-N) | **Pending** | Dibutuhkan agar arsip lintas tahun rapi |
| Pengelolaan agenda, pengumuman, galeri | **Pending** | Tanpa CMS: disimpan di kode; dibahas ulang untuk R3 |
| Informasi fakultas dan program studi | **Pending** | Belum dibahas; sumber datanya belum jelas |
| Role-based access control (`superadmin`, `petugas`) | **MVP** | ADR-0008 |
| Peran `koordinator` (mengisi timeline divisinya) dan `ketua` (melihat laporan progres) | **MVP** (modul timeline) | **Tanpa akses ke data wisudawan maupun rekap kehadiran** (keputusan D14) |
| Modul timeline pekerjaan panitia: pekerjaan per divisi, Oktober–Desember 2026, laporan progres untuk ketua | **MVP — urutan prioritas *Pending*** | Modul terpisah dari kehadiran; bidang data dan alur belum dirinci; ditafsirkan sebagai opsi B pada grilling #17 |
| Log audit (login, ekspor, hapus data) | **MVP** | ADR-0008 |
| Laporan dan ekspor data | **Pending** | Kemungkinan tidak relevan tanpa data wisudawan |
| Pencarian NIM + unduh QR | **MVP** | Dipindah dari Future oleh D7 |
| QR code / tiket digital | **MVP** | Dipindah dari Future oleh D7 |
| Dashboard peserta (login wisudawan) | Future enhancement | |
| Informasi administrasi personal | Future enhancement | |
| Unduhan undangan / kartu peserta | Future enhancement | |
| Informasi tempat duduk | Future enhancement | |
| Informasi keluarga / tamu (personal) | Future enhancement | Info umum untuk tamu tetap MVP |
| Pengelolaan data wisudawan | Future enhancement | |

Belum ada fitur berstatus *Out of scope* — akan diisi bila ada yang ditolak secara eksplisit.

## 5. Rilis — **Keputusan D2 (final)**

| Rilis | Target | Isi |
|---|---|---|
| **R1** | Minggu 19–25 Oktober 2026 (tanggal ditetapkan rektorat, **tidak dapat digeser**; tanggal pasti *Pending*) | Satu halaman informatif Wisuda ke-70, konten statis dari surat edaran, arah visual awal yang disetujui |
| **R2a** | ± 26 Okt–1 Nov 2026 | Database + auth + **timeline minimal** (D14, D15) |
| **R2b** | Siap di staging ± 27 Nov (usulan); QR dibuka ± 4 Des; **sebelum gladi (9 Des, resmi)** | Modul kehadiran QR (D7) + portal informasi lengkap; tanpa CMS |
| **R3** | Setelah 10 Desember 2026 | Mode pasca-acara: galeri, e-book, survei + arsip lintas tahun |

## 6. Acceptance criteria R1 (draft)

- [ ] Hanya memuat informasi yang tercantum di surat edaran atau sudah dikonfirmasi panitia; selain itu tampil sebagai "segera diumumkan".
- [ ] Arah visual disetujui pemilik proyek sebelum implementasi.
- [ ] Responsif mulai lebar 320px; tanpa scroll horizontal.
- [ ] WCAG 2.1 AA: kontras teks ≥ 4.5:1, navigasi keyboard, teks alternatif gambar, menghormati `prefers-reduced-motion`.
- [ ] Meta title/description, Open Graph & Twitter card, `lang="id"`.
- [ ] Lighthouse mobile: target Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95 (angka target, belum disepakati).
- [ ] Konten ke-69 tetap dapat diakses setelah pemindahan domain (lihat ADR-0002).
- [ ] Lolos uji di staging dengan HTTPS sebelum DNS production dipindah.

## 7. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Surat edaran terlambat | R1 minim konten | Tampilkan hanya fakta pasti; slot "segera diumumkan" |
| Jadwal R1 sangat sempit (≈5–7 hari kerja) | Kualitas/keamanan menurun | Ruang lingkup R1 dibatasi satu halaman, tanpa DB/auth |
| Pemindahan domain gagal | Situs tidak dapat diakses saat launching | Ganti DNS saja, server lama tetap hidup ≥ 2 minggu (ADR-0002) |
| Repo di akun GitHub pribadi | Akses kode hilang bila pemilik tidak aktif | Pindah ke organisasi UNINUS sebelum serah terima |
| Foto hosting di Google Drive | Embed gagal, link rusak | Strategi penyimpanan media dibahas sebelum R3 |
| Lonjakan trafik hari-H | Situs lambat/down | Halaman di-render statis/di-cache; uji beban sebelum 9 Des (*Pending*) |
| Hak pakai foto pihak ketiga | Masalah hukum | Pemilik proyek menyatakan foto boleh dipakai; catat sumber per foto |
| Data mahasiswa asli pernah berada di Google Sheet yang dapat dibaca publik | Paparan data pribadi | Pemilik proyek diminta mengubah akses ke Restricted; data asli tidak dipakai untuk dev/test |
| QR dapat diambil orang lain lewat tebakan NIM (ADR-0004) | Absensi gladi bisa dititipkan; daftar wisudawan bisa dikumpulkan | Token QR bertanda tangan, rate limiting, petugas mencocokkan nama di layar pemindai |
| Pemindaian gagal saat hari-H (jaringan, perangkat) | Antrean macet di acara resmi | Absensi manual cadangan, simulasi skala penuh, uji jaringan di lokasi |
| Jaringan dinyatakan andal, tetapi lokasi belum ditentukan | Klaim belum bisa diverifikasi; mode online bergantung padanya | Uji jaringan di lokasi begitu ditentukan; gladi sebagai uji lapangan |
| Scanner gagal membaca sebagian layar HP | Antrean melambat | Scanner terkonfirmasi bisa baca QR di layar HP; cadangan input NIM manual tercatat di sistem; uji berbagai kondisi layar |
| Input NIM manual disalahgunakan; tanpa pemeriksaan KTM/KTP di pintu masuk (D17) | Kehadiran palsu / titipan | Catat metode, petugas, waktu; tampilkan nama/prodi untuk konfirmasi petugas; tinjau rekap manual vs scan; risiko diterima pemilik proyek |
| Jam tiap sesi dan pembagian wisudawan per sesi (10 Des) belum ada | Pemindai dan komunikasi ke wisudawan | Minta surat edaran/panitia; sesi dibuat di dashboard bila jam sudah pasti |
| Data final baru ± 27 Nov dan masih berubah sampai ± 6 Des, saat QR sudah dibuka (± 4 Des) (usulan, belum dikonfirmasi BAAK) | Wisudawan baru/koreksi tanpa QR; data basi | Import idempoten, tambah/ubah manual, token QR stabil, batas pendaftaran ditetapkan BAAK |
| Periode retensi belum ditetapkan; tidak ada kebijakan data universitas; tidak ada pemberitahuan privasi (keputusan pemilik proyek) | Kepatuhan UU PDP | ADR-0007: BAAK pemilik data dan menetapkan retensi; desain data mendukung penghapusan/anonimisasi; rekomendasi pemberitahuan singkat tetap terbuka |

## 8. Pertanyaan terbuka

- Tanggal pasti launching R1.
- Isi surat edaran Wisuda ke-70.
- Arah visual final — mockup arah 2 "Gading & Zamrud" dan arah 3 "Monumen" (D6) diputuskan di gate Senin 19 Okt, lalu dituangkan ke `DESIGN_SYSTEM.md`.
- Tanggal gladi resik dan hari-H final.
- Lokasi gladi dan hari-H.
- Periode retensi data wisudawan (ditetapkan BAAK; ADR-0007).
- Data apa yang ditampilkan setelah pencarian NIM.
- Strategi penyimpanan media (galeri, e-book).
- Perlu tidaknya backend terpisah (Fastify), PostgreSQL, dan pilihan ORM — diputuskan di awal R2 (ADR-0001).
