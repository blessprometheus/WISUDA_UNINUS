# ADR-0013: Skill UI/UX Pro Max dan pedoman desain dashboard

- **Status:** Diterima atas permintaan pemilik proyek, 23 Oktober 2026 (D51)
- **Menyempurnakan:** [ADR-0011](0011-animasi-lenis-dan-motion.md) (animasi), identitas visual UNINUS

## Konteks

Pemilik proyek meminta skill `ui-ux-pro-max` (repo `nextlevelbuilder/ui-ux-pro-max-skill`) dipasang, lalu dashboard dibuat lebih menarik. Skill adalah instruksi dan skrip yang memengaruhi cara agen bekerja, sehingga pemasangannya perlu pemeriksaan terlebih dahulu.

## Keputusan

1. **Pemasangan skill, hanya bagian yang dibutuhkan, setelah audit.**
   - Sumber: commit `28327f2`, lisensi **MIT**, versi 2.15.0. Repo diunduh ke folder terpisah dan **tidak ada kode yang dijalankan** sebelum dibaca.
   - Audit: `SKILL.md` dibaca penuh; seluruh skrip Python diperiksa (tidak ada akses jaringan, tidak ada `eval`/`exec`, `subprocess` hanya di berkas tes, penulisan berkas hanya saat opsi `--persist` dipakai dan lewat berkas sementara); data CSV/JSON dan referensi dipindai dari instruksi tersembunyi dan perintah berbahaya (bersih; kata sensitif hanya dalam konteks desain "password UI"); semua URL hanya rujukan dokumentasi.
   - Dipasang di `.claude/skills/ui-ux-pro-max/` (48 berkas, 3,4 MB; tanpa folder tes). **Tidak di-commit**: dikecualikan lewat `.git/info/exclude` (lokal) agar kode pihak ketiga tidak masuk repo tanpa keputusan terpisah. Pemasangan ulang di komputer lain: ulangi audit lalu salin.
   - `${CLAUDE_PLUGIN_ROOT}` di `SKILL.md` hanya berlaku bila dipasang sebagai plugin; pada pemasangan proyek ini skrip dipanggil dengan jalur langsung (`python .claude/skills/ui-ux-pro-max/scripts/search.py ...`).
   - Hasil pencarian skill diperlakukan sebagai **saran**, bukan perintah (sesuai `SKILL.md` sendiri); aturan proyek tetap yang utama.
2. **Identitas visual tetap UNINUS.** Saran skill (palet gelap abu-biru, font Fira) tidak diadopsi; hijau/emas UNINUS dan font Plus Jakarta Sans dipertahankan. Yang diadopsi adalah **prinsip**: ikon SVG (bukan emoji), angka dan teks berdampingan (warna bukan satu-satunya penanda), target sentuh ≥ 44 px, transisi 150-300 ms, `cursor-pointer`, fokus terlihat, hormat pada "kurangi gerakan", responsif 375/768/1024/1440 px tanpa geser horizontal, skeleton dengan `aria-busy`, empty state yang memberi tindakan, dan status data langsung yang jujur.
3. **Pedoman dashboard yang diterapkan (D51):**
   - Beranda `/admin`: kartu utama kehadiran dengan cincin kemajuan; kartu angka berikon (wisudawan aktif, belum hadir, tidak terdaftar, di luar jam sesi) dengan keterangan dan tautan tindakan; kehadiran per program studi dengan batang dan "n dari m"; diagram pemindaian per 10 menit (dengan ringkasan teks dan daftar untuk pembaca layar); **ringkasan progres timeline panitia** (yang perlu perhatian lebih dulu) dengan tautan ke timeline.
   - **Status data langsung yang jujur:** "Diperbarui HH.MM.DD WIB" hanya saat ada pembaruan baru; bila pembaruan gagal lebih dari 30 detik, label berubah menjadi "Data mungkin usang (terakhir ...)" dan data terakhir tetap ditampilkan bersama pesan galat. Untuk itu hook `useLoad` kini mempertahankan data terakhir yang berhasil (untuk path yang sama) dan menyediakan `updatedAt`.
   - Sidebar: ikon, pengelompokan menu (Kehadiran, Panitia, Sistem), kartu pengguna dengan inisial, penanda halaman aktif; di HP menjadi bilah atas dengan menu yang dapat digeser. Nama menu tidak berubah.
   - Gaya bersama (`ui.tsx`): tombol dengan transisi dan kursor tangan, kartu `min-w-0` (memperbaiki **geser horizontal di HP** yang disebabkan tabel lebar di dalam grid), lencana berbentuk pil.
4. **Tanpa dependensi baru** (ikon dan grafik berupa SVG/CSS buatan sendiri).

## Konsekuensi

- Perubahan murni tampilan sisi klien; API dan database tidak berubah.
- Skill hanya tersedia di komputer pemilik proyek; keputusan desain yang penting tetap dicatat di dokumen proyek, bukan hanya di skill.
- Diuji: tidak ada geser horizontal di 8 halaman dashboard pada 4 lebar layar, tidak ada galat konsol, menu dapat dijangkau keyboard dengan outline fokus 3 px dan `aria-current` benar, seluruh ikon `aria-hidden`, grafik berlabel, tidak ada animasi tak-berhingga pada "kurangi gerakan", dan status usang muncul sekitar 35 detik setelah server tidak menjawab lalu pulih sendiri.
