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
3. ~~**Superadmin wajib 2FA (D19, final)**~~ **dicabut oleh D40 (lihat bagian Pembaruan D40)**. Isi awal: password + kode 6 digit (TOTP) dari aplikasi authenticator di HP, plus **kode pemulihan** yang disimpan terpisah. Pemilik proyek belum punya aplikasi authenticator, jadi panduan pemasangan (Google/Microsoft Authenticator) disiapkan sebelum akun dibuat. Petugas cukup password. Audit PKKMB perlu memeriksa apakah 2FA sudah ada; bila belum, ditambahkan di backend hasil adaptasi. Sesi petugas dibatasi pada halaman pemindai dan **dinonaktifkan setelah hari-H**.
4. Password disimpan sebagai **hash modern**: **scrypt** (`node:crypto`, N=2^15, r=8, p=1, salt acak; parameter tersimpan di hash). Dipilih karena memory-hard dan tanpa dependensi native tambahan (Argon2id/bcrypt memerlukan paket pihak ketiga). Kebijakan: minimal 12 karakter, memadukan ≥ 2 jenis karakter. Tidak ada password polos di kode, log, atau repo.
5. **Pembatasan percobaan login** per akun dan per IP.
6. **Pembaruan (D14):** peran `koordinator` (mengelola timeline divisinya) dan `ketua` (melihat laporan progres) ditambahkan untuk modul timeline. Keduanya **tidak mendapat akses ke data wisudawan maupun rekap kehadiran**. Pemisahan ini wajib ditegakkan **di sisi server** (pemeriksaan peran di setiap endpoint dan query), bukan hanya dengan menyembunyikan menu. Bila kelak perlu akses ke data wisudawan, itu keputusan BAAK (ADR-0007) dan ADR baru.
7. Login `koordinator` dan `ketua` memakai password. (Usulan 2FA untuk keduanya gugur bersama D40.)

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

## Pembaruan D40 (22 Okt 2026): 2FA dihapus seluruhnya

**Keputusan pemilik proyek:** tidak ada 2FA di situs ini. Semua peran (superadmin, petugas, koordinator, ketua) masuk dengan email dan kata sandi. Menggantikan D19, D35, dan catatan 16 Okt.

**Yang dihapus:** endpoint `/auth/2fa/*` dan `/admin/users/:id/reset-2fa`, layar pendaftaran/kode/kode pemulihan di halaman masuk, kolom dan tombol 2FA di halaman Pengguna, enkripsi rahasia TOTP (`TOTP_ENCRYPTION_KEY` tidak lagi dipakai), dependensi `otpauth`, skrip `admin:reset-2fa`, serta kolom/tabel 2FA di database (migrasi `003_hapus_2fa.sql`, semua sesi dicabut). Penggantinya untuk akses darurat: `npm run admin:reset-password -- --email ...`.

**Pengendali yang tetap berlaku (bukan pengganti 2FA, tetapi dasar):** kata sandi acak buatan sistem yang tampil sekali, kebijakan sandi ≥ 12 karakter, hash scrypt, penguncian akun bertahap (5 gagal → 1 menit, berlipat hingga 60 menit), pembatasan laju login per IP, CSRF + pemeriksaan Origin, cookie `HttpOnly`/`Secure`/`SameSite`, masa sesi pendek (superadmin 8 jam, petugas 12 jam), sesi lama dicabut saat login baru, pencabutan sesi dan reset sandi oleh superadmin, log audit.

**Risiko yang diterima pemilik proyek:** satu kata sandi yang bocor (mis. dari phishing atau kata sandi yang dipakai ulang) langsung memberi akses ke data pribadi ± 1.500 wisudawan (NIM, nama, program studi) dan ekspor rekap. Dengan 2FA, bocornya kata sandi saja tidak cukup. Pengembang menyarankan tetap mempertimbangkan 2FA untuk superadmin; keputusan ada pada pemilik proyek. Saran praktis tanpa 2FA: jangan memakai ulang kata sandi, simpan kata sandi di pengelola kata sandi, nonaktifkan akun petugas setelah hari-H, dan batasi jumlah superadmin.

**Memasang kembali:** perlu pekerjaan baru (kode dan migrasi dibuang, bukan dimatikan); riwayat Git sebelum D40 memuat implementasinya.

## Pembaruan D41 (22 Okt 2026): satu superadmin

Hanya ada **satu superadmin**: pemilik proyek. Ia yang membuat semua akun ketua, koordinator, dan petugas scan dari dashboard. Peran `superadmin` **tidak dapat dibuat lewat dashboard/API** (ditolak 422); akun superadmin pertama dibuat lewat CLI (`npm run admin:create`). Pengaman "superadmin aktif terakhir tidak dapat dinonaktifkan" tetap berlaku. Bila kelak perlu superadmin cadangan (risiko bus factor), itu keputusan baru dan dibuat lewat CLI oleh pemilik proyek.

## Pembaruan D43 (22 Okt 2026): kebijakan sandi dapat dilonggarkan atas keputusan pemilik proyek

Pemilik proyek memutuskan memakai sandi pilihannya sendiri untuk semua akun (superadmin, ketua, koordinator, petugas scan), dengan kebijakan sandi dimatikan "dulu". Diimplementasikan sebagai pengaturan server `ENFORCE_PASSWORD_POLICY=0` (bawaan tetap **aktif**: ≥ 12 karakter, ≥ 2 jenis). Saat dimatikan hanya sandi kosong atau > 256 karakter yang ditolak. Sandi pilihan sendiri hanya dapat diset lewat CLI di server (`admin:create-accounts` kolom ke-5, `--update-passwords`, dan `admin:reset-password --password-file`); dashboard tetap membuat sandi acak. Sandi tidak ditulis di repo, kode, argumen perintah, audit, atau log; berkas yang memuatnya dihapus setelah dipakai.

**Risiko yang diterima pemilik proyek (sudah disampaikan pengembang):** sandi pendek dan berpola sama antar akun (mis. `kor…@530`) mudah ditebak; daftar itu juga sudah tertulis di percakapan pengembangan sehingga dianggap bocor. Pengendali yang tetap melindungi: penguncian akun bertahap (5 gagal → 1 menit, berlipat hingga 60 menit), pembatasan laju login per IP, CSRF, dan log audit. Karena superadmin dapat melihat dan mengekspor data pribadi ± 1.500 wisudawan, sangat disarankan mengganti sandi superadmin dengan yang panjang dan unik begitu situasinya memungkinkan, lalu menyalakan kembali kebijakan (hapus `ENFORCE_PASSWORD_POLICY=0`).

## Risiko

| Risiko | Mitigasi |
|---|---|
| Akun superadmin tunggal bocor atau hilang | Kata sandi acak + penguncian + pembatasan laju; akses darurat lewat server (`admin:reset-password`); 2FA dihapus (D40, risiko diterima) |
| Ketergantungan pada satu orang (bus factor = 1) | Dokumentasi operasional di docs/; pertimbangkan satu superadmin cadangan sebelum hari-H |
| Petugas gagal login di hari-H | Akun dibuat dan diuji pada gladi; password diserahkan lewat jalur aman, bukan grup umum |

## Konsekuensi

- Modul timeline tidak boleh memperlambat modul kehadiran yang memiliki tenggat keras (gladi). Urutan prioritas keduanya *Pending* keputusan pemilik proyek.
- Struktur akun harus menyiapkan pencatatan **log audit** (login, ekspor, hapus data).
