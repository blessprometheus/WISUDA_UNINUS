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
| D24 | 14 Okt 2026 | Repo dipindah ke akun pemilik proyek: `github.com/blessprometheus/WISUDA_UNINUS` (private, semua branch + riwayat). Repo lama `aqmalazza/WISUDA_UNINUS_2026` tidak diperbarui lagi (remote lokal `friend`). Rencana jangka panjang: transfer ke organisasi GitHub UNINUS sebelum serah terima | [DEPLOYMENT](DEPLOYMENT.md) |
| D23 | 14 Okt 2026 | **Merevisi D4**: Claude boleh menjalankan runbook deploy lewat alias SSH milik pemilik proyek; staging mandiri, produksi dengan "go" eksplisit; DNS/SSL produksi/firewall/aaPanel tetap oleh pemilik proyek; dilarang menyentuh proyek lain di server. Pengecekan awal §2.A dijalankan segera (pemilik proyek setuju uji lebih awal dari jadwal) | [ADR-0010](adr/0010-deploy-oleh-claude-dengan-batasan.md) |
| D22 | 14 Okt 2026 | R1 memuat bagian **"Arsip Wisuda ke-69" berisi tiga tautan** (galeri, e-book, survei) ke tujuan yang sama dengan situs lama; redirect 301 `/galeri69.html` → `/arsip/69`. Tidak ada domain/tautan eksternal lain yang bergantung pada URL ke-69. Backup situs lama **belum diunduh** (syarat sebelum DNS dipindah) | [ADR-0002](adr/0002-pemindahan-domain-tanpa-menghapus-server-lama.md) |
| D21 | 14 Okt 2026 | Arah visual R1 = **arah 3 "Monumen"**; foto belum ada → hero **tanpa foto** (latar hijau gelap + garis lengkung kubah emas + tipografi besar), slot foto disiapkan agar foto dapat ditambahkan tanpa mengubah tata letak. Penyesuaian detail menunggu pemilik proyek melihat versi revisi ("kita lihat dulu"); persetujuan final identitas visual = gate Sen 19 Okt | [PRD §8](PRD.md) |
| D20 | 14 Okt 2026 | Impor data wisudawan = **CSV UTF-8 saja** + templat (tanpa pembaca `.xlsx`); `TANGGAL LULUS` disimpan sebagai **teks informatif** (tidak dipakai untuk logika/filter); `faculty` dan `degree_level` tidak wajib | [AUDIT](AUDIT_PKKMB_BACKEND.md), [ADR-0009](adr/0009-adaptasi-backend-pkkmb.md) |
| D19 | 14 Okt 2026 | 2FA (TOTP) **wajib untuk superadmin** + kode pemulihan; 2FA untuk koordinator/ketua tetap *Pending*; petugas tanpa 2FA | [ADR-0008](adr/0008-akun-peran-dan-autentikasi.md) |
| D18 | 14 Okt 2026 | **Mengubah sebagian D11**: backend kehadiran diadaptasi dari backend PKKMB (Fastify + PostgreSQL) setelah **audit**; frontend tetap Next.js; repo PKKMB asli tidak diubah. Skala PKKMB (± 1.300 mhs, 4 bangku scan, lancar) setara Wisuda ke-70 (± 1.500–1.600 sementara, 4 scanner) | [ADR-0009](adr/0009-adaptasi-backend-pkkmb.md) |
| D17 | 14 Okt 2026 | NIM tidak ditemukan: **tidak dianggap kasus umum** (pengalaman PKKMB: kendala nyata hanya QR tidak terbaca → petugas input NIM manual). Versi minimal opsi B: layar pemindai mencatat entri **"tidak terdaftar"** (nama + NIM yang diketik, petugas, waktu) yang **tidak dihitung hadir**, tanpa alur persetujuan. Tidak ada pemeriksaan KTM/KTP di pintu masuk. Jawaban pemilik proyek soal otoritas BAAK ("tidak bisa seperti itu") ditafsirkan: tidak ada alur persetujuan BAAK — *menunggu konfirmasi* | [ADR-0005](adr/0005-pemindai-usb-di-laptop-online.md) |
| D16 | 14 Okt 2026 | Data final BAAK ± **20 Nov 2026**; data masih bisa berubah sampai ± 3 hari sebelum gladi (≈ 29 Nov); batas pendaftaran ada tetapi belum ditetapkan. Maka: import **idempoten** (upsert per NIM, token QR **tidak berubah** saat impor ulang), tambah/ubah/nonaktifkan wisudawan satu per satu, log perubahan data | [PRD §4](PRD.md) |
| D15 | 14 Okt 2026 | Urutan: R1 → **timeline minimal** (status pekerjaan, tenggat, catatan progres; ± 10 divisi) → **kehadiran** → penyempurnaan timeline. Gladi resik ≈ 3 hari sebelum hari-H = **± Rabu, 2 Des 2026** (perkiraan, belum resmi) | Jadwal R2 di bawah |
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

Acuan: hari-H Sabtu 5 Des 2026; gladi ± Rabu 2 Des 2026 (perkiraan dari "± 3 hari sebelum hari-H"). Hari ini Rabu 14 Okt → ± 7 minggu sampai gladi.

| Minggu | Kegiatan | Gate |
|---|---|---|
| 19–25 Okt | **R1 live** (lihat jadwal R1) | Persetujuan production |
| 19–25 Okt (paralel R1) | **Audit backend PKKMB** (auth, staff, online, konfigurasi, dependensi) — laporan ke pemilik proyek | Gate sebelum adaptasi (ADR-0009) |
| 26 Okt–1 Nov | Setup database, auth (superadmin + 2FA bila disetujui, koordinator, ketua), **timeline minimal** (± 10 divisi; status, tenggat, catatan progres; tampilan ringkas ketua) | Timeline dipakai koordinator |
| 2–20 Nov | **Modul kehadiran** (adaptasi dari PKKMB): import Excel (validasi + duplikat NIM), pencarian NIM + unduh QR, sesi, halaman pemindai (scanner HID + input manual), rekap + ekspor, log audit, retensi | Fitur lengkap di staging |
| ± 9–20 Nov | **Data final dari BAAK + retensi tertulis** | Sebelum import data asli ke produksi |
| 21–27 Nov | Uji: simulasi scan skala penuh (4 scanner nyata, layar HP nyata), uji beban unduhan QR, uji restore backup, tinjauan keamanan, review kode | Persetujuan production |
| 28 Nov–1 Des | **Buka unduhan QR untuk wisudawan**, **bekukan kode** (hanya perbaikan kritis), SOP cadangan manual dicetak | — |
| ± 2 Des | **Gladi resik = uji lapangan pertama** (jaringan, scanner, antrean) | Evaluasi sebelum hari-H |
| 5 Des | Hari-H | — |
| Setelah 5 Des | R3: galeri, e-book, survei, arsip; penyempurnaan timeline | — |

**Risiko jadwal:** satu pengembang untuk tiga rilis. Bila R1 atau timeline molor, kehadiran yang memakan waktu uji. Cadangan: absensi manual, dan fitur kehadiran **diprioritaskan di atas penyempurnaan timeline**.

## Input yang ditunggu dari pemilik proyek

- [ ] **Ubah akses Google Sheet data mahasiswa menjadi Restricted** (saat ini dapat dibaca publik)
- [ ] Pasang aplikasi authenticator (Google/Microsoft Authenticator) di HP superadmin sebelum akun dibuat (± akhir Okt)
- [ ] BAAK menetapkan periode retensi data wisudawan secara tertulis (sebelum import data asli ke produksi)
- [ ] Konfirmasi PostgreSQL terpasang/dapat dipasang di server aaPanel **ini** (PKKMB dikatakan memakai PostgreSQL; belum jelas server yang sama)
- [ ] Tanggal gladi resik resmi (perkiraan ± 2 Des) dan lokasi gladi/hari-H
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
