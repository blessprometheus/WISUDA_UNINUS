# ADR-0010: Deploy dapat dijalankan Claude melalui SSH dan panel aaPanel dengan batasan

- **Status:** Diterima (atas permintaan pemilik proyek, 14 Oktober 2026)
- **Direvisi (D36, 19 Okt 2026):** akses panel aaPanel diizinkan, lihat bagian "Pembaruan D36" di bawah.
- **Merevisi:** D4 (deploy manual oleh pemilik proyek) dan ADR-0002 poin kewenangan

## Konteks

D4 menetapkan deploy dijalankan manual oleh pemilik proyek, dan Claude tidak memegang akses server. Pemilik proyek meminta aturan itu diubah agar Claude dapat menjalankan langkah deploy sendiri, untuk menghemat waktu menjelang R1 yang tidak dapat digeser. Server aaPanel kemungkinan juga menampung proyek lain (mis. PKKMB) dan kelak menyimpan data pribadi wisudawan.

## Keputusan

1. Claude **boleh menjalankan perintah di server lewat SSH**, menggunakan **alias SSH yang sudah dikonfigurasi pemilik proyek di komputernya** (mis. `ssh wisuda-staging`). Kunci privat, password, dan URL panel **tidak pernah diberikan atau dikutip** ke Claude; autentikasi tetap berada di komputer pemilik proyek.
2. **Akun server:** disarankan akun khusus non-root tanpa `sudo`, dibatasi ke direktori aplikasi. Bila hanya `root` yang tersedia, itu dicatat sebagai risiko yang diterima pemilik proyek, dan perintah Claude tetap dibatasi sesuai poin 3–5.
3. **Staging:** Claude menjalankan langkah runbook (DEPLOYMENT.md §2.A–G) secara mandiri, mengumumkan tiap tahap, dan melaporkan hasil apa adanya.
4. **Produksi:** setiap deploy produksi memerlukan **"go" eksplisit** dari pemilik proyek untuk tag/commit tertentu. Rollback boleh dijalankan Claude segera bila verifikasi pasca-deploy gagal, lalu dilaporkan.
5. **Selalu dikerjakan pemilik proyek, bukan Claude:** perubahan record DNS, penerbitan/penggantian SSL domain produksi, perubahan pengaturan aaPanel di luar folder/proses aplikasi ini, firewall, akun pengguna, dan segala penghapusan di server lama.
6. **Dilarang bagi Claude di server:** menyentuh situs/proyek lain (termasuk PKKMB dan file `.env`-nya), membaca rahasia di luar yang dibutuhkan aplikasi ini, menghapus direktori di luar folder aplikasi, `rm -rf` dengan path tidak eksplisit, mengubah database yang bukan milik proyek ini, dan menjalankan skrip dari internet (`curl | sh`).
7. Setiap perintah yang mengubah server dicatat di `~/deploy-wisuda.log` (waktu, perintah, hasil ringkas) dan dilaporkan ke pemilik proyek.
8. Pemilik proyek dapat mencabut kewenangan ini kapan saja dengan menghapus alias SSH atau kunci di server.
9. Deploy key GitHub tetap **hanya-baca**; hanya kunci publiknya yang keluar dari server.

## Pembaruan D36 (19 Okt 2026): akses panel aaPanel diizinkan

Atas permintaan pemilik proyek, yang akan men-deploy langsung ke domain produksi `wisuda.uninus.ac.id`:

1. Claude **boleh mengoperasikan aaPanel** untuk keperluan proyek ini, hanya lewat **sesi yang dibuka dan di-login sendiri oleh pemilik proyek** (mis. browser pane atau computer use). Sandi, kode 2FA panel, dan URL panel berisi token **tetap tidak boleh dikirim lewat chat, ditulis di repo/dokumen/log, atau disimpan** oleh Claude.
2. Yang boleh dikerjakan di panel: membuat situs dan reverse proxy untuk domain proyek ini, membuat database dan user PostgreSQL proyek ini, menerbitkan SSL Let's Encrypt untuk domain proyek ini, dan mengatur layanan/Node proyek ini.
3. Tetap **dilarang**: menyentuh situs lain di panel (termasuk PKKMB), firewall, akun pengguna panel, pengaturan global, serta menghapus apa pun yang bukan milik proyek ini (termasuk situs lama). Perubahan DNS tetap dikerjakan pemilik proyek (di luar panel).
4. Produksi tetap memerlukan **"go" eksplisit** untuk tag/commit tertentu; setiap tindakan di panel diumumkan dan dilaporkan apa adanya.
5. Pemilik proyek dapat mencabutnya kapan saja dengan menutup sesinya atau mengganti sandi panel. Disarankan mengganti sandi panel setelah deploy selesai.
6. **Risiko yang diterima pemilik proyek:** panel menampung proyek lain dan kelak data pribadi wisudawan; sesi panel berhak akses luas. Mitigasi: batasan poin 2–3, pemantauan layar oleh pemilik proyek selama sesi, dan tinjauan ulang sebelum data asli diimpor.

## Alternatif yang ditolak

- **Tetap manual penuh (D4 asli)** — aman, tetapi lambat dan rawan salah langkah di minggu R1.
- **Memberi Claude kredensial panel/root langsung** — tidak diperlukan; alias SSH di komputer pemilik proyek memberi hasil sama tanpa memindahkan rahasia.

## Konsekuensi

- Risiko operasional naik: kesalahan perintah oleh Claude berdampak langsung ke server. Dimitigasi dengan batasan di atas, runbook tertulis, `.next.prev` untuk rollback, dan staging lebih dulu.
- Dokumen yang mengatakan "Claude tidak memegang akses server" (AGENTS.md, CLAUDE.md, DEPLOYMENT.md) diperbarui agar konsisten.
- Bila nantinya modul kehadiran menyimpan data pribadi di server yang sama, kewenangan ini ditinjau ulang sebelum data asli diimpor.
