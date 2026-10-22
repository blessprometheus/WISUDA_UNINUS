# Glossary — Domain Wisuda UNINUS

Bahasa bersama untuk kode, dokumen, dan diskusi. Bila sebuah istilah dipakai di kode, gunakan identifier di kolom "Kode" secara konsisten.

| Istilah | Kode (usulan) | Definisi | Status |
|---|---|---|---|
| **Wisuda ke-N** | `Ceremony` (`number`) | Satu penyelenggaraan wisuda dengan nomor urut. Wisuda 2026 = **ke-70**. | Fakta |
| **Gelombang** | `Session` / `wave` | Pembagian pelaksanaan dalam satu Wisuda ke-N (situs ke-69 mengelompokkan galeri per gelombang). Wisuda ke-70 sementara **satu gelombang**. | Fakta; nama kode belum final |
| **Hari-H** | — | Tanggal pelaksanaan gelombang. Ke-70: **Kamis, 10 Desember 2026**, dua sesi (pagi dan siang), di The Trans Luxury Hotel Bandung; gladi resik **Rabu, 9 Desember 2026**. Dikonfirmasi pemilik proyek 22 Okt 2026 (menggantikan Sabtu 5 Desember). | Fakta |
| **Wisudawan** | `Graduate` | Mahasiswa yang diwisuda. **Datanya tidak diproses di MVP** (lihat PRD). | Fakta |
| **Panitia** | `Admin` | Pengelola konten situs. Satu-satunya pengguna yang login di MVP. | Asumsi — peran & hak akses belum dibahas |
| **Surat edaran** | — | Dokumen resmi panitia; sumber satu-satunya untuk detail acara (lokasi, jadwal, syarat, biaya). Konten situs tidak boleh menebak di luar dokumen ini. | Fakta |
| **Mode pra-acara** | — | Situs fokus pada informasi & panduan menjelang hari-H. | Usulan |
| **Mode pasca-acara** | — | Situs fokus pada galeri, e-book, survei setelah hari-H (seperti situs ke-69 saat ini). | Fakta (pola situs lama) |
| **Arsip** | `Archive` | Kumpulan konten Wisuda ke-N terdahulu yang tetap dapat diakses. Arsip pertama = ke-69. | Fakta (D1, D5) |
| **E-Book Wisuda** | `Ebook` | Buku kenangan digital (PDF) per Wisuda ke-N. | Fakta |
| **R1 / R2 / R3** | — | Tahap rilis — lihat [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). | Keputusan D2 |
