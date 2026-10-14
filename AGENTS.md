# AGENTS.md — Aturan Kerja Proyek Website Wisuda UNINUS

Aturan ini berlaku untuk semua coding agent (Claude Code, OpenCode, Codex, dll.) dan kontributor manusia.

> **Status proyek:** Phase 0 — Discovery & Grilling (dimulai 14 Oktober 2026).
> Belum ada kode aplikasi. Lihat [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) untuk fase & gate terkini.

## Sumber kebenaran

| Topik | Dokumen |
|---|---|
| Tujuan, ruang lingkup, klasifikasi fitur | [docs/PRD.md](docs/PRD.md) |
| Istilah domain | [docs/GLOSSARY.md](docs/GLOSSARY.md) |
| Fase, rilis, jadwal, gate persetujuan | [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) |
| Server, deploy, pemindahan domain, rollback | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Keputusan arsitektur | [docs/adr/](docs/adr/) |

Dokumen lain (`ARCHITECTURE`, `TECH_STACK`, `DATABASE_DESIGN`, `API_SPEC`, `DESIGN_SYSTEM`, `SECURITY`) dibuat saat keputusannya diambil — bukan sebelumnya.

## Komunikasi

- Seluruh komunikasi dengan pemilik proyek **wajib Bahasa Indonesia** yang profesional dan natural.
- Istilah teknis, nama framework/library, dan identifier kode boleh Bahasa Inggris.
- Penjelasan keputusan teknis wajib dalam Bahasa Indonesia.
- Teks yang tampil ke pengguna situs (label, pesan error, konten) berbahasa Indonesia; `lang="id"`.

## Engineering

- TypeScript dengan strict type checking. Hindari `any` tanpa justifikasi tertulis di kode.
- Separation of concerns; prioritaskan readability dan maintainability; komponen reusable.
- Hindari overengineering. Setiap dependency baru harus punya alasan yang jelas.
- Ikuti dokumentasi resmi; cek kompatibilitas versi; jangan pakai deprecated API.
- Jangan hardcode credentials/secrets. Gunakan environment variables; file `.env*` tidak di-commit.
- Terapkan input validation dan error handling.
- Terapkan autentikasi, otorisasi, dan perlindungan data sesuai kebutuhan. Modul kehadiran memproses **data pribadi wisudawan** (NIM, nama, prodi, tanggal lulus) — tunduk pada UU PDP; lihat ADR-0003 & ADR-0004.
- Jangan pernah memakai, menyalin, atau mengutip data mahasiswa asli untuk development/testing. Gunakan data palsu.
- Perubahan schema database hanya melalui migrations.
- Automated tests sesuai tingkat risiko fitur.
- Jangan mengubah atau menghapus data penting tanpa persetujuan.

## Dokumentasi & Workflow

- Sebelum implementasi, baca dokumen yang relevan di tabel di atas.
- Periksa ADR yang berlaku sebelum mengubah desain atau arsitektur.
- Jelaskan rencana perubahan sebelum mengerjakan pekerjaan besar.
- Setelah implementasi, jalankan pemeriksaan yang relevan (typecheck, lint, test, build) dan laporkan hasilnya **apa adanya**.
- Jangan mengklaim kode sudah diuji jika pengujian belum dijalankan.
- Perbarui dokumentasi saat ada perubahan arsitektur atau keputusan penting. Di dokumen, pisahkan **fakta**, **asumsi**, **usulan**, dan **keputusan final**.
- **Jangan deploy ke production tanpa persetujuan eksplisit pemilik proyek.**

## Batasan Proyek

- Jangan membuat file aplikasi sebelum gate fase terkait disetujui (lihat IMPLEMENTATION_PLAN).
- Jangan menganggap fitur usulan sebagai kebutuhan final — cek klasifikasi di PRD.
- Repository referensi PKKMB bersifat **read-only**. Jangan memodifikasinya.
- Jangan mengganti tech stack yang disepakati tanpa pembahasan dan ADR baru.
- Jangan melakukan tindakan destruktif (hapus file/data/server/DNS record, force push, dll.) tanpa izin.
- Jangan simpan URL panel server, token, atau kredensial di repo, dokumen, maupun log.
- Tidak semua pekerjaan harus selesai dalam satu sesi.
