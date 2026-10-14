# Deployment

> **Status: DRAFT.** Perintah konkret (path, nama proyek Node, versi) diisi saat Phase 3 setelah project dibuat.
> Jangan menyimpan URL panel, password, atau token di dokumen ini.

## 1. Infrastruktur (fakta per 14 Oktober 2026)

| Item | Nilai | Status |
|---|---|---|
| Panel server | aaPanel | Fakta |
| Akses SSH | Tersedia untuk pemilik proyek | Fakta |
| Runtime Node.js | `v24.19.0` (Node 24 LTS) | Fakta |
| DNS `uninus.ac.id` | Dikelola pemilik proyek | Fakta |
| `wisuda.uninus.ac.id` saat ini | Di server lain (situs ke-69) | Fakta |
| Repository | `github.com/aqmalazza/WISUDA_UNINUS_2026` (private) | Fakta |
| Reverse proxy | Kemungkinan Nginx bawaan aaPanel | Asumsi |
| Versi Node target | Sama dengan server (`24.x`); dikunci via `engines` di `package.json`; kompatibilitas Next.js diverifikasi saat setup | Usulan |

**Prinsip:** Claude/agent tidak membutuhkan akses server. Semua langkah server dijalankan pemilik proyek.

## 2. Alur deploy R1 — Keputusan D4: manual via runbook

Kerangka (detail diisi saat Phase 3):

1. SSH ke server → masuk ke direktori aplikasi.
2. `git pull` dari branch `main` (catat commit hash sebelumnya untuk rollback).
3. `npm ci`
4. `npm run build` — **berhenti bila gagal**; situs yang sedang berjalan tidak terganggu.
5. Restart proyek Node di aaPanel.
6. Health check: buka halaman utama, cek status HTTP 200, cek HTTPS.
7. Catat tanggal, commit hash, dan hasil di log deploy.

**Rollback aplikasi:** `git checkout <commit-sebelumnya>` → `npm ci` → `npm run build` → restart.

CI/CD (GitHub Actions → SSH deploy key) diusulkan untuk R2 — memerlukan ADR tersendiri.

## 3. Pemindahan domain — Keputusan D5 ([ADR-0002](adr/0002-pemindahan-domain-tanpa-menghapus-server-lama.md))

| # | Langkah | Kapan | Status |
|---|---|---|---|
| 1 | Backup lengkap situs ke-69 dari server lama (semua HTML, gambar, aset) + daftar seluruh link eksternal (Google Drive, Wasabi, survei) | Sebelum perubahan apa pun | ☐ |
| 2 | Buat subdomain staging di DNS → arahkan ke server aaPanel → pasang SSL | 15–16 Okt (usulan) | ☐ |
| 3 | Deploy & uji situs baru di staging | 22 Okt (usulan) | ☐ |
| 4 | Turunkan TTL record DNS `wisuda` (mis. 300 detik) | 1–2 hari sebelum launching | ☐ |
| 5 | Tambahkan domain `wisuda.uninus.ac.id` di aaPanel | Hari launching | ☐ |
| 6 | **Ubah record DNS** `wisuda` ke IP server aaPanel (bukan menghapus server lama) | Hari launching, dengan persetujuan | ☐ |
| 7 | Terbitkan SSL Let's Encrypt di aaPanel setelah DNS mengarah; verifikasi HTTPS | Hari launching | ☐ |
| 8 | Verifikasi: halaman utama, `/arsip/69`, redirect `/galeri69.html` → 301 | Hari launching | ☐ |
| 9 | Server lama **tetap hidup minimal 2 minggu** sebagai cadangan | Sampai ± 2 minggu setelah launching | ☐ |
| 10 | Kembalikan TTL ke nilai normal; nonaktifkan server lama hanya setelah persetujuan | Setelah masa cadangan | ☐ |

**Rollback domain:** kembalikan record DNS `wisuda` ke IP server lama. Dengan TTL rendah, efeknya dalam hitungan menit.

**Catatan SSL:** sertifikat Let's Encrypt via HTTP challenge baru dapat diterbitkan setelah DNS mengarah ke aaPanel, sehingga ada jeda singkat. Lakukan di jam sepi trafik.
