# ADR-0008: Akun, peran, dan autentikasi

- **Status:** Diterima untuk R2 awal; peran tambahan (koordinator, ketua) *Pending*
- **Tanggal:** 14 Oktober 2026

## Konteks

Admin saat ini satu orang: **superadmin** (pemilik proyek). Pemilik proyek berencana menambah akses untuk **koordinator divisi** dan **ketua** (melihat/mereview hasil) terkait fitur timeline pekerjaan yang direncanakan "nanti" (lihat PRD — Pending). Scanner dioperasikan 4 petugas. Akun admin dapat mengimpor, melihat, dan mengekspor data pribadi ± 1.400 wisudawan.

## Keputusan

1. **Peran R2 awal: `superadmin` dan `petugas`.**
   - `superadmin`: semua fitur (import, sesi, rekap, ekspor, hapus/anonimkan data, kelola akun).
   - `petugas`: hanya halaman pemindai dan input NIM manual; tidak dapat melihat atau mengekspor daftar wisudawan.
2. **Pembuatan dan pencabutan akun hanya oleh superadmin.** Tidak ada pendaftaran publik.
3. **Superadmin wajib 2FA (D19, final)**: password + kode 6 digit (TOTP) dari aplikasi authenticator di HP, plus **kode pemulihan** yang disimpan terpisah. Pemilik proyek belum punya aplikasi authenticator, jadi panduan pemasangan (Google/Microsoft Authenticator) disiapkan sebelum akun dibuat. Petugas cukup password. Audit PKKMB perlu memeriksa apakah 2FA sudah ada; bila belum, ditambahkan di backend hasil adaptasi. Sesi petugas dibatasi pada halaman pemindai dan **dinonaktifkan setelah hari-H**.
4. Password disimpan sebagai **hash modern**: **scrypt** (`node:crypto`, N=2^15, r=8, p=1, salt acak; parameter tersimpan di hash). Dipilih karena memory-hard dan tanpa dependensi native tambahan (Argon2id/bcrypt memerlukan paket pihak ketiga). Kebijakan: minimal 12 karakter, memadukan ≥ 2 jenis karakter. Tidak ada password polos di kode, log, atau repo.
5. **Pembatasan percobaan login** per akun dan per IP.
6. **Pembaruan (D14):** peran `koordinator` (mengelola timeline divisinya) dan `ketua` (melihat laporan progres) ditambahkan untuk modul timeline. Keduanya **tidak mendapat akses ke data wisudawan maupun rekap kehadiran**. Pemisahan ini wajib ditegakkan **di sisi server** (pemeriksaan peran di setiap endpoint dan query), bukan hanya dengan menyembunyikan menu. Bila kelak perlu akses ke data wisudawan, itu keputusan BAAK (ADR-0007) dan ADR baru.
7. Login `koordinator` dan `ketua` memakai password; **2FA wajib untuk `ketua` dan `koordinator`** diusulkan karena akunnya berumur panjang (Oktober–Desember) — *Pending* persetujuan.

## Pembaruan (D35, 15 Okt 2026): 2FA superadmin dapat dinonaktifkan

Atas permintaan pemilik proyek, kewajiban 2FA superadmin dapat dimatikan lewat `REQUIRE_SUPERADMIN_2FA=0`. **Default tetap wajib.** Bila dimatikan: superadmin tanpa 2FA langsung masuk; superadmin yang sudah mengaktifkan 2FA tetap diminta kode; dashboard menampilkan peringatan. Pengembang menyarankan tetap wajib di produksi karena akun ini mengakses data pribadi ±1.500 wisudawan (UU PDP); keputusan akhir ada pada pemilik proyek. Dapat dinyalakan kembali kapan saja tanpa perubahan kode.

## Pembaruan (16 Okt 2026): login lokal sementara tanpa pendaftaran 2FA

**Keputusan final pemilik proyek:** kewajiban pendaftaran verifikasi dua langkah dinonaktifkan
sementara untuk pengujian lokal dengan `REQUIRE_SUPERADMIN_2FA=0` di `.env.local`.
Akun superadmin yang belum mengaktifkan 2FA dapat masuk menggunakan email dan kata sandi.
Konfigurasi lokal tidak di-commit; default aplikasi tetap wajib 2FA.

**Cara menerapkan:** hentikan `npm run local:start` dengan Ctrl+C, jalankan kembali perintah
tersebut, muat ulang `/masuk`, lalu login ulang untuk memperoleh sesi baru. Sesi yang dibuat
sebelum konfigurasi berubah tidak otomatis dinaikkan hak aksesnya. Akun yang sebelumnya
sudah mengaktifkan 2FA tetap diminta kode sesuai D35.

**Cara mengaktifkan kembali:** isi `REQUIRE_SUPERADMIN_2FA=1`, mulai ulang API, lalu login ulang.

## Risiko

| Risiko | Mitigasi |
|---|---|
| Akun superadmin tunggal bocor atau hilang | 2FA; kode pemulihan disimpan di tempat terpisah; rencana akses darurat lewat server (SSH) didokumentasikan |
| Ketergantungan pada satu orang (bus factor = 1) | Dokumentasi operasional di docs/; pertimbangkan satu superadmin cadangan sebelum hari-H |
| Petugas gagal login di hari-H | Akun dibuat dan diuji pada gladi; password diserahkan lewat jalur aman, bukan grup umum |

## Konsekuensi

- Modul timeline tidak boleh memperlambat modul kehadiran yang memiliki tenggat keras (gladi). Urutan prioritas keduanya *Pending* keputusan pemilik proyek.
- Struktur akun harus menyiapkan pencatatan **log audit** (login, ekspor, hapus data).
