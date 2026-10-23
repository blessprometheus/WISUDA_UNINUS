# ADR-0012: Pekerjaan timeline: tanggal mulai/selesai, deskripsi, dan bukti unggahan

- **Status:** Diterima atas permintaan pemilik proyek, 23 Oktober 2026 (D50). Tiga asumsi pengembang sudah dikonfirmasi pemilik proyek pada hari yang sama: (1) tanggal selesai = tanggal target, (2) bukti dapat dilihat semua divisi, (3) deskripsi terlihat oleh divisi lain.
- **Menyempurnakan:** [ADR-0008](0008-akun-peran-dan-autentikasi.md) (D46, hak akses timeline)

## Konteks

Form "Tambah pekerjaan" per divisi semula hanya berisi judul, status, dan tenggat. Pemilik proyek meminta kolom: judul pekerjaan, tanggal mulai, tanggal selesai, deskripsi, upload bukti (opsional), dan status pekerjaan. Unggahan berkas adalah fitur baru yang belum tercakup dokumen mana pun, dan menyangkut keamanan (berkas dari pengguna), sehingga keputusannya dicatat di sini.

## Keputusan

1. **Kolom pekerjaan.** `start_date` (tanggal mulai), `end_date` (tanggal selesai), `description` (maksimal 2000 karakter), `status` (belum, berjalan, selesai, tertunda). Keduanya tanggal opsional; bila keduanya diisi, tanggal selesai tidak boleh sebelum tanggal mulai (dicek di server dan database).
   - **Tanggal selesai = tanggal TARGET selesai** (menggantikan kolom `due_date`, diganti nama lewat migrasi `004` sehingga data lama utuh). Tanggal inilah yang menentukan "terlambat" (status bukan selesai dan tanggal selesai sudah lewat) dan "tenggat terdekat" di beranda. **Dikonfirmasi pemilik proyek.** Bila kelak diperlukan tanggal selesai AKTUAL, perlu kolom terpisah.
2. **Bukti unggahan (opsional).**
   - Jenis: **JPG, PNG, WebP, PDF**. Jenis ditentukan dari **isi berkas** (tanda awal/magic bytes), bukan dari nama atau Content-Type; berkas yang menyamar ditolak (422).
   - Ukuran **≤ 5 MB** per berkas (413 bila lebih), **maksimal 5 berkas per pekerjaan** (409; ditegakkan dengan kunci baris agar unggahan serentak tidak melampauinya).
   - **Foto dikecilkan otomatis di peramban** sebelum diunggah bila lebih dari 1,5 MB: sisi terpanjang maksimal 2400 px, dikodekan ulang JPEG kualitas 85%, orientasi dihormati, PNG transparan diberi latar putih, dan hasil yang tidak lebih kecil tidak dipakai. Alasannya, foto kamera HP umumnya 3-12 MB dan akan ditolak batas 5 MB. Diuji: foto derau acak 11,6 MB (4000×3000, kasus terburuk) menjadi 2,4 MB (2400×1800). PDF tidak diubah sehingga harus ≤ 5 MB. Pengecilan hanya kemudahan klien; batas dan pemeriksaan jenis tetap ditegakkan server.
   - Dikirim sebagai **isi mentah** (tanpa multipart), mengikuti pola impor CSV: **tanpa dependensi baru**. Nama berkas dari klien hanya dipakai sebagai nama tampilan setelah dibersihkan (tanpa jalur/simbol berbahaya, ekstensi dipaksa sesuai jenis hasil deteksi).
   - Disimpan di **PostgreSQL (`BYTEA`)**, bukan di folder web: tidak ada jalur berkas yang dapat ditebak atau disajikan statis, ikut tercadangkan bersama database, dan terhapus otomatis bersama pekerjaannya.
   - Disajikan hanya lewat API yang memeriksa login dan peran (melihat: semua peran timeline; mengubah: divisi sendiri): gambar dibuka di tab (`inline`), **PDF diunduh (`attachment`)**; selalu dengan `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox; default-src 'none'`, dan `Cache-Control: private, no-store`.
   - Pembatasan laju unggah: 30 permintaan per 10 menit; wajib CSRF; tindakan tambah/hapus dicatat di log audit (tanpa isi berkas).
3. **Hak akses** (menyempurnakan tabel D46):

   | | Koordinator divisi sendiri | Koordinator divisi lain | Ketua | Superadmin |
   |---|---|---|---|---|
   | Judul, status, tanggal, **deskripsi**, jumlah catatan dan bukti | lihat + ubah | **lihat saja** | lihat | lihat + ubah |
   | **Berkas bukti** (daftar, buka, unduh) | lihat + unggah/hapus | **lihat saja** | lihat | lihat + unggah/hapus |
   | **Isi catatan progres** | lihat + tulis | **tidak** (403) | lihat | lihat + tulis |

   **Dikonfirmasi pemilik proyek (23 Okt):** deskripsi terlihat oleh divisi lain (rincian pekerjaan, setara judul), dan bukti dapat dilihat semua divisi. Isi catatan progres tetap hanya untuk divisi sendiri, ketua, dan superadmin (D46). Daftar bukti dan unduhannya memeriksa login lebih dulu, sehingga pengunjung tanpa login mendapat 401 (bukan 404) dan tidak dapat menebak id yang ada.
4. **Hak tulis tetap** hanya superadmin dan koordinator divisi itu; ketua hanya melihat.

## Alternatif yang ditolak

- **Berkas di sistem file server** (mis. folder di luar web root): perlu pengelolaan izin, jalur, dan cadangan terpisah; lebih banyak risiko path traversal. Volume kecil (puluhan MB) cocok untuk database.
- **Plugin multipart (`@fastify/multipart`)**: satu dependensi baru untuk fitur yang cukup dengan isi mentah.
- **Semua jenis berkas atau dokumen Office**: menambah permukaan serangan (makro, HTML aktif) tanpa kebutuhan yang jelas.
- **Penyimpanan objek eksternal (S3/Wasabi)**: kredensial dan biaya tambahan; belum diperlukan.

## Risiko dan konsekuensi

- **Tidak ada pemindaian virus.** Mitigasi: daftar jenis sempit, jenis dari isi berkas, PDF selalu diunduh (tidak dijalankan di dalam situs), isi gambar disajikan dengan CSP sandbox, dan hanya pengguna yang masuk dengan hak tertentu yang dapat mengunduh. Pengunduh PDF tetap sebaiknya hanya membuka berkas dari rekan yang dikenal.
- **Ukuran database membesar.** Batas teoretis 25 MB per pekerjaan; dengan ± 14 divisi dan puluhan pekerjaan per divisi, ratusan MB di kasus terburuk. Cadangan `pg_dump` ikut membesar; pantau ruang disk sebelum hari-H.
- Migrasi `004` mengganti nama kolom `due_date` menjadi `end_date` dan menambah tabel `task_evidence`; kode lama yang masih memakai `due_date` tidak kompatibel (seluruh kode, tes, dan skrip e2e sudah disesuaikan).
- Berkas bukti tidak dihapus otomatis setelah acara; penghapusan pekerjaan oleh superadmin ikut menghapus buktinya. Kebijakan retensi bukti perlu ditetapkan bila memuat data pribadi.
