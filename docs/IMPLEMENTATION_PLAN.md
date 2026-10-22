# Implementation Plan

> **Fase saat ini: Phase 3 — Project Setup (R1)**, dimulai 14 Oktober 2026 atas persetujuan pemilik proyek; Phase 0 ditutup. Gate visual final (Phase 2) tetap berlaku sebelum staging.
>
> **Versi terkunci saat setup (diverifikasi dari registry npm 14 Okt 2026):** Next.js 16.4.0, React 19.3.0, Tailwind CSS 4, TypeScript 5 (bawaan scaffold; TypeScript 7.0.2 sudah rilis tetapi belum dievaluasi), ESLint 9, Node `>=24 <25`. `npm audit --omit=dev`: 0 kerentanan; 5 kerentanan *high* hanya di rantai alat lint (`eslint-config-next → fast-glob → braces`), tidak ikut ke produksi; `npm audit fix --force` **tidak** dipakai karena menurunkan versi.
>
> **Catatan:** redirect `/galeri69.html` memakai status **308** (setara 301 untuk SEO, diatur Next.js `permanent: true`).

## Log keputusan

| # | Tanggal | Keputusan | Rujukan |
|---|---|---|---|
| D1 | 14 Okt 2026 | MVP = Opsi A: portal informasi + CMS admin, tanpa data pribadi wisudawan | [PRD §4](PRD.md) |
| D2 | 14 Okt 2026 | Rilis bertahap R1 → R2 → R3 | [PRD §5](PRD.md) |
| D3 | 14 Okt 2026 | Stack R1: Next.js App Router + TS strict + Tailwind, tanpa DB; keputusan backend/DB ditunda ke R2 | [ADR-0001](adr/0001-r1-nextjs-tanpa-database.md) |
| D4 | 14 Okt 2026 | Deploy R1 manual oleh pemilik proyek via runbook; CI/CD diusulkan untuk R2 | [DEPLOYMENT](DEPLOYMENT.md) |
| D5 | 14 Okt 2026 | Pindah domain via perubahan DNS; backup situs ke-69; server lama hidup ≥ 2 minggu; ke-69 ke `/arsip/69` + redirect 301 | [ADR-0002](adr/0002-pemindahan-domain-tanpa-menghapus-server-lama.md) |
| D6 | 14 Okt 2026 | Mockup arah visual yang dibuat: **2 "Gading & Zamrud"** dan **3 "Monumen"** (arah 1 tidak dilanjutkan). Tidak ada larangan/keharusan visual tambahan. Pilihan final di gate Sen 19 Okt. Mockup (privat): https://claude.ai/artifact/AsCJLejQEsDxS2qfEbcSZa | [PRD §8](PRD.md) |
| D7 | 14 Okt 2026 | **Revisi D1**: modul kehadiran QR (import data, cari NIM + unduh QR, sesi gladi & hari-H, scan, rekap) masuk R2; CMS konten dihapus; absensi manual sebagai cadangan | [ADR-0003](adr/0003-revisi-ruang-lingkup-modul-kehadiran.md) |
| D8 | 14 Okt 2026 | Pengambilan QR cukup dengan NIM, dengan mitigasi wajib — risiko diterima pemilik proyek | [ADR-0004](adr/0004-pencarian-qr-cukup-dengan-nim.md) |
| D9 | 14 Okt 2026 | Pemindaian: 4 scanner USB di 4 laptop petugas, halaman web online, tanpa PWA/offline; token QR acak pendek (lookup DB). Lokasi belum ditentukan. | [ADR-0005](adr/0005-pemindai-usb-di-laptop-online.md) |
| D40 | 22 Okt 2026 | **2FA dihapus seluruhnya** atas keputusan pemilik proyek (menggantikan D19 dan D35): kode, endpoint, layar, tes, dependensi `otpauth`, dan kolom/tabel database (migrasi `003_hapus_2fa.sql`, semua sesi dicabut). Pengganti akses darurat: `admin:reset-password`. Pengembang tetap menyarankan mempertimbangkan 2FA; risiko diterima pemilik proyek. 73 tes API lulus; alur browser nyata terverifikasi. **Belum dipasang ke produksi** | [ADR-0008](adr/0008-akun-peran-dan-autentikasi.md) |
| D39 | 22 Okt 2026 | **D38 dipasang ke produksi** ("go b3d7296"): cadangan DB, migrasi 002, build API, restart `wisuda-api`; skema terverifikasi (batas lama hilang, indeks nama-per-tanggal dan satu-aktif ada). Pemilik proyek: lokasi gladi dan wisuda sama; jam sesi menyusul. Catatan "lokasi yang sama" ditambahkan di halaman Informasi (belum dipasang) | — |
| D38 | 22 Okt 2026 | **Beberapa sesi per tanggal** (migrasi `002`): batas UNIQUE (ceremony, tanggal) dilepas karena hari-H punya sesi pagi dan siang. Penggantinya: nama sesi unik per tanggal (tanpa beda huruf besar/kecil) + jam sesi tidak boleh beririsan (dicek di aplikasi; sesi bersebelahan persis boleh) + tetap hanya satu sesi aktif. Nama berkas rekap CSV memuat nama sesi. 79 tes lulus; mutasi (cek bentrok dimatikan) terdeteksi 2 tes. Dipasang ke produksi 22 Okt (D39) | — |
| D37 | 22 Okt 2026 | **Jadwal & lokasi final dari pemilik proyek**: gladi Rabu 9 Des 2026, wisuda Kamis 10 Des 2026 dua sesi (pagi, siang), The Trans Luxury Hotel (Jl. Gatot Subroto No. 289, Bandung). Menggantikan Sabtu 5 Des. Frontend diperbarui. Jadwal R2 digeser (usulan, belum dikonfirmasi BAAK). Dampak pada backend diselesaikan di D38 | — |
| D36 | 19 Okt 2026 | **Merevisi ADR-0010**: Claude boleh mengoperasikan aaPanel (situs, reverse proxy, database, SSL milik proyek ini) lewat sesi yang di-login pemilik proyek sendiri; tanpa sandi/URL token di chat atau repo; tetap dilarang menyentuh PKKMB/situs lain, firewall, akun, DNS; produksi tetap dengan "go" eksplisit. Pemilik proyek men-deploy langsung ke `wisuda.uninus.ac.id` tanpa staging | [ADR-0010](adr/0010-deploy-oleh-claude-dengan-batasan.md) |
| D35 | 15 Okt 2026 | **2FA superadmin dapat dinonaktifkan** (permintaan pemilik proyek; merevisi D19 secara opsional): `REQUIRE_SUPERADMIN_2FA=0`, **default tetap wajib**; dimatikan di `.env.local` lokal. Pengembang tetap menyarankan wajib di produksi. 78 tes lulus | [ADR-0008](adr/0008-akun-peran-dan-autentikasi.md) |
| D34 | 15 Okt 2026 | **Timeline selesai** (branch `feat/r2-timeline`): divisi, pekerjaan (status, tenggat), catatan progres, laporan untuk ketua (persentase, keterlambatan, catatan terbaru); koordinator terisolasi per divisi, **ketua hanya melihat**, superadmin mengelola divisi dan penugasan (banyak koordinator per divisi). `/timeline` di balik saklar STAF. 74 tes API lulus (perusakan isolasi divisi dan peran ketua terdeteksi); 8 skenario browser tiga peran lulus | [API_SPEC](API_SPEC.md) |
| D33 | 15 Okt 2026 | **Dashboard superadmin selesai** (branch `feat/r2-dashboard`, di balik saklar STAF): Ringkasan (segar otomatis 10 dtk), Sesi, Wisudawan, Impor Data (pratinjau → impor), Kehadiran (+ ekspor CSV, tinjau tidak terdaftar), Pengguna (buat akun, kata sandi sementara sekali, reset sandi/2FA, nonaktifkan), Audit & Retensi. Backend baru: kelola akun + log audit + skrip `admin:reset-2fa`; **60 tes lulus**; 13 skenario browser lulus. Pengaman "tidak menonaktifkan diri sendiri" awalnya tidak teruji (mutasi lolos) → tes diperkuat | [API_SPEC](API_SPEC.md) |
| D32 | 15 Okt 2026 | **Hero final untuk sekarang** ("ok cukup sementara"): odometer angka 70, kilau emas, huruf per huruf, kubah tergambar, Lenis + Motion; **tampilan HP sama dengan desktop**. `feat/r1-motion` digabung (fast-forward) ke `feat/r1-nextjs` (`d2336e2`). Kompromi diterima: Lighthouse mobile Performance 92–93, LCP lab 3,1 dtk (render nyata ± 0,33 dtk); dapat diganti angka statis bila skor jadi prioritas | ADR-0011 (di `feat/r1-nextjs`) |
| D31 | 15 Okt 2026 | **Animasi R1** (permintaan pemilik proyek): hero CSS murni (teks terangkat, kubah tergambar) + **Lenis** gulir halus + **Motion** (paralaks, reveal saat digulir); aman untuk "kurangi gerakan" dan tanpa JavaScript. Dikerjakan di branch terpisah `feat/r1-motion` (dari `feat/r1-nextjs`), pratinjau `localhost:3200`. Lighthouse mobile P99 / A100, LCP 1,7 dtk. Menunggu penilaian visual pemilik proyek sebelum digabung ke jalur R1 | ADR-0011 (di branch `feat/r1-motion`) |
| D30 | 15 Okt 2026 | **Frontend: login + 2FA + layar pemindai selesai** (branch `feat/r2-staff-ui`), di balik saklar build `NEXT_PUBLIC_STAFF_ENABLED` (default mati → 404). Hasil berwarna (hijau/kuning/merah) + bunyi berbeda, antrean berurutan, kolom scanner selalu terfokus, NIM manual, tidak terdaftar, pilihan meja 1–4. Uji browser nyata 11 skenario lulus. **Dua bug nyata ditemukan dan diperbaiki lewat uji ini:** (1) POST tanpa isi JSON ditolak 400 → 2FA setup gagal dan "Keluar" tidak mencabut sesi di server; (2) Next.js 16 mempertahankan state halaman → kode pemulihan 2FA bisa tersisa di layar setelah keluar (diperbaiki dengan navigasi penuh). Belum: dashboard superadmin, uji dengan scanner USB fisik | [DEPLOYMENT §G2](DEPLOYMENT.md) |
| D29 | 15 Okt 2026 | **Frontend: halaman Cari NIM + unduh QR selesai** (branch `feat/r2-qr-lookup`): tampil nama, prodi, NIM, QR, tombol unduh; di balik saklar build `NEXT_PUBLIC_QR_ENABLED` (default mati → R1 tidak berubah). Verifikasi browser nyata (7 skenario), QR didecode = token DB (bukan NIM), Lighthouse A11y 100. Temuan: `rewrites` Next.js terkunci saat build. Urutan layar berikutnya: pemindai (bunyi: ya) → dashboard | [DEPLOYMENT §G2](DEPLOYMENT.md) |
| D28 | 15 Okt 2026 | Urutan: **modul kehadiran dulu** (pilihan B), timeline sesudahnya. ± 15 koordinator (satu divisi dapat punya lebih dari satu koordinator → `user_divisions` banyak-ke-banyak). **Ketua hanya melihat laporan** (tidak mengubah status pekerjaan). Backend kehadiran selesai: impor CSV idempoten, pencarian NIM + QR, sesi, pemindaian, rekap/ekspor, tidak-terdaftar, anonimisasi; **51 tes lulus**; tiga mutasi keamanan tambahan terdeteksi tes | [API_SPEC](API_SPEC.md) |
| D27 | 15 Okt 2026 | **Backend R2 — tahap 1 selesai** (branch `feat/r2-backend`): kerangka Fastify di `server/`, migrasi `001_init.sql` (16 tabel), autentikasi lengkap (scrypt, sesi ber-hash, CSRF, penguncian bertahap, TOTP terenkripsi + kode pemulihan, anti-replay, rotasi sesi), `GET /admin/users`, skrip `migrate` dan `admin:create`. 19 tes integrasi lulus terhadap PostgreSQL 17 terisolasi (port 55433); dua mutasi keamanan terdeteksi tes. **Belum:** impor, pencarian NIM + QR, sesi/scan, rekap, timeline, frontend R2, audit tahap 2 sisa | [DATABASE_DESIGN](DATABASE_DESIGN.md) |
| D26 | 15 Okt 2026 | Skema R2 disetujui: tabel `ceremonies`; input manual boleh di luar jendela waktu sesi namun ditandai; sesi login petugas 12 jam / superadmin 8 jam / koordinator & ketua 7 hari. Implementasi backend dimulai di branch `feat/r2-backend` | [DATABASE_DESIGN](DATABASE_DESIGN.md) |
| D25 | 15 Okt 2026 | Pekerjaan beralih ke backend/frontend R2; pembuatan subdomain/Nginx/SSL staging **ditunda atas permintaan pemilik proyek** (aplikasi R1 sudah berjalan di server pada `127.0.0.1:3000`). PostgreSQL terlihat ada di server (`127.0.0.1:5432`), database belum dibuat. Draf [DATABASE_DESIGN](DATABASE_DESIGN.md) dan [API_SPEC](API_SPEC.md) menunggu persetujuan sebelum kode backend ditulis | [AUDIT](AUDIT_PKKMB_BACKEND.md) |
| D24 | 14 Okt 2026 | Repo dipindah ke akun pemilik proyek: `github.com/blessprometheus/WISUDA_UNINUS` (private, semua branch + riwayat). Repo lama `aqmalazza/WISUDA_UNINUS_2026` tidak diperbarui lagi (remote lokal `friend`). Rencana jangka panjang: transfer ke organisasi GitHub UNINUS sebelum serah terima | [DEPLOYMENT](DEPLOYMENT.md) |
| D23 | 14 Okt 2026 | **Merevisi D4**: Claude boleh menjalankan runbook deploy lewat alias SSH milik pemilik proyek; staging mandiri, produksi dengan "go" eksplisit; DNS/SSL produksi/firewall/aaPanel tetap oleh pemilik proyek; dilarang menyentuh proyek lain di server. Pengecekan awal §2.A dijalankan segera (pemilik proyek setuju uji lebih awal dari jadwal) | [ADR-0010](adr/0010-deploy-oleh-claude-dengan-batasan.md) |
| D22 | 14 Okt 2026 | R1 memuat bagian **"Arsip Wisuda ke-69" berisi tiga tautan** (galeri, e-book, survei) ke tujuan yang sama dengan situs lama; redirect 301 `/galeri69.html` → `/arsip/69`. Tidak ada domain/tautan eksternal lain yang bergantung pada URL ke-69. Backup situs lama **belum diunduh** (syarat sebelum DNS dipindah) | [ADR-0002](adr/0002-pemindahan-domain-tanpa-menghapus-server-lama.md) |
| D21 | 14 Okt 2026 | Arah visual R1 = **arah 3 "Monumen"**; foto belum ada → hero **tanpa foto** (latar hijau gelap + garis lengkung kubah emas + tipografi besar), slot foto disiapkan agar foto dapat ditambahkan tanpa mengubah tata letak. Penyesuaian detail menunggu pemilik proyek melihat versi revisi ("kita lihat dulu"); persetujuan final identitas visual = gate Sen 19 Okt | [PRD §8](PRD.md) |
| D20 | 14 Okt 2026 | Impor data wisudawan = **CSV UTF-8 saja** + templat (tanpa pembaca `.xlsx`); `TANGGAL LULUS` disimpan sebagai **teks informatif** (tidak dipakai untuk logika/filter); `faculty` dan `degree_level` tidak wajib | [AUDIT](AUDIT_PKKMB_BACKEND.md), [ADR-0009](adr/0009-adaptasi-backend-pkkmb.md) |
| D19 | 14 Okt 2026 | 2FA (TOTP) **wajib untuk superadmin** + kode pemulihan; 2FA untuk koordinator/ketua tetap *Pending*; petugas tanpa 2FA | [ADR-0008](adr/0008-akun-peran-dan-autentikasi.md) |
| D18 | 14 Okt 2026 | **Mengubah sebagian D11**: backend kehadiran diadaptasi dari backend PKKMB (Fastify + PostgreSQL) setelah **audit**; frontend tetap Next.js; repo PKKMB asli tidak diubah. Skala PKKMB (± 1.300 mhs, 4 bangku scan, lancar) setara Wisuda ke-70 (± 1.500–1.600 sementara, 4 scanner) | [ADR-0009](adr/0009-adaptasi-backend-pkkmb.md) |
| D17 | 14 Okt 2026 | NIM tidak ditemukan: **tidak dianggap kasus umum** (pengalaman PKKMB: kendala nyata hanya QR tidak terbaca → petugas input NIM manual). Versi minimal opsi B: layar pemindai mencatat entri **"tidak terdaftar"** (nama + NIM yang diketik, petugas, waktu) yang **tidak dihitung hadir**, tanpa alur persetujuan. Tidak ada pemeriksaan KTM/KTP di pintu masuk. Jawaban pemilik proyek soal otoritas BAAK ("tidak bisa seperti itu") ditafsirkan: tidak ada alur persetujuan BAAK — *menunggu konfirmasi* | [ADR-0005](adr/0005-pemindai-usb-di-laptop-online.md) |
| D16 | 14 Okt 2026 | Data final BAAK ± **20 Nov 2026**; data masih bisa berubah sampai ± 3 hari sebelum gladi (≈ 29 Nov); batas pendaftaran ada tetapi belum ditetapkan. Maka: import **idempoten** (upsert per NIM, token QR **tidak berubah** saat impor ulang), tambah/ubah/nonaktifkan wisudawan satu per satu, log perubahan data | [PRD §4](PRD.md) |
| D15 | 14 Okt 2026 | Urutan: R1 → **timeline minimal** (status pekerjaan, tenggat, catatan progres; ± 10 divisi) → **kehadiran** → penyempurnaan timeline. Gladi resik resmi **Rabu, 9 Des 2026**, hari-H **Kamis, 10 Des 2026** (D37; sebelumnya perkiraan ± 2 Des) | Jadwal R2 di bawah |
| D14 | 14 Okt 2026 | Modul timeline pekerjaan per divisi (Okt–Des) + laporan progres untuk ketua = MVP, modul terpisah; koordinator & ketua **tanpa akses data wisudawan/kehadiran**. Urutan prioritas terhadap modul kehadiran *Pending*. (Pemilik proyek tidak memilih A/B/C secara eksplisit; ditafsirkan sebagai B.) | [PRD §4](PRD.md), [ADR-0008](adr/0008-akun-peran-dan-autentikasi.md) |
| D13 | 14 Okt 2026 | Peran R2: `superadmin` (pemilik proyek, 2FA) dan `petugas` (hanya pemindai). Akun dibuat/dicabut hanya oleh superadmin. Koordinator divisi & ketua + fitur timeline = *Pending*, tidak dibangun di R2 awal | [ADR-0008](adr/0008-akun-peran-dan-autentikasi.md) |
| D12 | 14 Okt 2026 | Pemilik data = BAAK; periode retensi *Pending* (usulan: ≤ 1 tahun lalu anonimkan); tanpa pemberitahuan privasi atas keputusan pemilik proyek (risiko dicatat); arsip ke-70 tanpa nama/NIM | [ADR-0007](adr/0007-kepemilikan-dan-retensi-data-wisudawan.md) |
| D11 | 14 Okt 2026 | R2 = satu aplikasi Next.js + PostgreSQL (fallback MySQL/MariaDB), tanpa Fastify, tanpa monorepo; ORM Drizzle (usulan, diverifikasi saat setup); backup DB terjadwal + uji restore sebelum gladi | [ADR-0006](adr/0006-satu-aplikasi-nextjs-dengan-postgresql.md) |
| D10 | 14 Okt 2026 | Kode = **QR**, ditampilkan dari layar HP (unduh sebagai PNG); scanner bisa baca QR di layar HP; **input NIM manual** disediakan di halaman pemindai sebagai cadangan, dengan pencatatan metode/petugas/waktu | [ADR-0005](adr/0005-pemindai-usb-di-laptop-online.md) |

## Fase & gate

Setiap fase butuh persetujuan pemilik proyek sebelum lanjut. Karena R1 berjadwal ketat, Phase 0–2 **untuk R1** dipadatkan; Phase 0–2 penuh tetap berjalan untuk R2.

| Fase | Deliverables | Gate (exit criteria) |
|---|---|---|
| **0. Discovery & Grilling** | Keputusan D1–D5, PRD draft, glossary | Ruang lingkup R1 jelas; arah visual siap dibuat mockup |
| **1. Documentation & Architecture** | PRD final, ADR, sitemap, keputusan teknis R2 | Disetujui pemilik proyek |
| **2. UI/UX Design** | Design direction, `DESIGN_SYSTEM.md`, mockup halaman | **Identitas visual disetujui pemilik proyek** |
| **3. Project Setup** | Next.js + tooling, lint, typecheck, struktur repo | Build bersih di lokal & server |
| **4. Implementation** | Fitur sesuai rilis | Acceptance criteria per fitur terpenuhi |
| **5. Testing & QA** | Uji fungsional, responsif, a11y, keamanan, performa | Laporan uji faktual |
| **6. Deployment & Handover** | Production, monitoring, backup, dokumen operasional | Persetujuan deploy production |

## Jadwal R1 (USULAN — belum dikonfirmasi pemilik proyek)

| Hari | Kegiatan | Gate |
|---|---|---|
| Kam–Jum, 15–16 Okt | Keputusan arah visual; 2–3 mockup arah visual; backup situs ke-69; buat subdomain staging; terima surat edaran | — |
| Sen, 19 Okt | **Persetujuan arah visual + konten** | Gate Phase 2 (R1) |
| Sen–Rab, 19–21 Okt | Setup project (Phase 3) + implementasi halaman R1 | — |
| Kam, 22 Okt | QA + deploy ke staging (HTTPS) | Persetujuan deploy |
| Jum, 23 Okt / tanggal rektorat | Pemindahan DNS → production | **Persetujuan production** |

## Jadwal R2 (USULAN — belum dikonfirmasi pemilik proyek)

Acuan (dikonfirmasi 22 Okt 2026, D37): gladi resik **Rabu 9 Des 2026**, hari-H wisuda **Kamis 10 Des 2026** dua sesi (pagi dan siang) di The Trans Luxury Hotel Bandung. Sebelumnya Sabtu 5 Des (sementara).

| Minggu | Kegiatan | Gate |
|---|---|---|
| 19–25 Okt | **R1 live** (lihat jadwal R1) | Persetujuan production |
| 19–25 Okt (paralel R1) | **Audit backend PKKMB** (auth, staff, online, konfigurasi, dependensi) — laporan ke pemilik proyek | Gate sebelum adaptasi (ADR-0009) |
| 26 Okt–1 Nov | Setup database, auth (superadmin tanpa 2FA sejak D40, koordinator, ketua), **timeline minimal** (± 10 divisi; status, tenggat, catatan progres; tampilan ringkas ketua) | Timeline dipakai koordinator |
| 2–20 Nov | **Modul kehadiran** (adaptasi dari PKKMB): import Excel (validasi + duplikat NIM), pencarian NIM + unduh QR, sesi, halaman pemindai (scanner HID + input manual), rekap + ekspor, log audit, retensi | Fitur lengkap di staging |
| ± 16–27 Nov (usulan, geser +7 hari) | **Data final dari BAAK + retensi tertulis** | Sebelum import data asli ke produksi |
| 28 Nov–3 Des | Uji: simulasi scan skala penuh (4 scanner nyata, layar HP nyata), uji beban unduhan QR, uji restore backup, tinjauan keamanan, review kode | Persetujuan production |
| ± 4–8 Des | **Buka unduhan QR untuk wisudawan (± 4 Des, ± 5 hari sebelum gladi)**, **bekukan kode** (hanya perbaikan kritis), SOP cadangan manual dicetak | — |
| 9 Des | **Gladi resik = uji lapangan pertama** (jaringan, scanner, antrean) | Evaluasi sebelum hari-H |
| 10 Des | Hari-H (2 sesi: pagi, siang) | — |
| Setelah 10 Des | R3: galeri, e-book, survei, arsip; penyempurnaan timeline | — |

**Risiko jadwal:** satu pengembang untuk tiga rilis. Bila R1 atau timeline molor, kehadiran yang memakan waktu uji. Cadangan: absensi manual, dan fitur kehadiran **diprioritaskan di atas penyempurnaan timeline**.

## Input yang ditunggu dari pemilik proyek

- [ ] **Ubah akses Google Sheet data mahasiswa menjadi Restricted** (saat ini dapat dibaca publik)
- [x] ~~Pasang aplikasi authenticator di HP superadmin~~ tidak diperlukan: 2FA dihapus (D40)
- [ ] BAAK menetapkan periode retensi data wisudawan secara tertulis (sebelum import data asli ke produksi)
- [ ] Konfirmasi PostgreSQL terpasang/dapat dipasang di server aaPanel **ini** (PKKMB dikatakan memakai PostgreSQL; belum jelas server yang sama)
- [x] Tanggal gladi (9 Des) dan hari-H (10 Des, 2 sesi) serta lokasi (The Trans Luxury Hotel, sama untuk gladi dan wisuda) dikonfirmasi 22 Okt. **Belum:** jam tiap sesi (menyusul), pembagian wisudawan per sesi
- [ ] Data wisudawan final dari BAAK (± 20 Nov); kontak/PIC di BAAK belum disebutkan
- [ ] BAAK menetapkan batas pendaftaran wisudawan (tanggal tutup)
- [x] Scanner bisa baca QR dari layar HP (dikonfirmasi pemilik proyek); mode HID keyboard belum diuji
- [ ] Contoh file import dengan data palsu (format sama dengan Excel BAAK)
- [ ] Surat edaran Wisuda ke-70 (dijanjikan minggu ini)
- [ ] Tanggal pasti launching R1 dari rektorat
- [ ] 5–15 foto resolusi asli (kampus, wisuda sebelumnya) + logo vektor bila ada
- [x] Versi Node.js di aaPanel — `v24.19.0`
- [ ] Backup lengkap file situs ke-69 (belum diunduh per 14 Okt) — simpan di luar repo; dibutuhkan untuk daftar tautan resmi (URL Google Drive galeri, e-book Wasabi)
- [ ] Subdomain staging
- [ ] Konfirmasi akses write ke repo GitHub
- [ ] (Opsional) Clone repo PKKMB ke folder terpisah untuk analisis read-only
