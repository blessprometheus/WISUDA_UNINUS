# ADR-0012: Pekerjaan timeline: tanggal mulai/selesai, deskripsi, dan bukti unggahan

- **Status:** Diterima untuk implementasi atas permintaan pemilik proyek, 23 Oktober 2026 (D50). Beberapa butir bertanda *Konfirmasi* adalah asumsi pengembang yang menunggu persetujuan pemilik proyek.
- **Menyempurnakan:** [ADR-0008](0008-akun-peran-dan-autentikasi.md) (D46, hak akses timeline)

## Konteks

Form "Tambah pekerjaan" per divisi semula hanya berisi judul, status, dan tenggat. Pemilik proyek meminta kolom: judul pekerjaan, tanggal mulai, tanggal selesai, deskripsi, upload bukti (opsional), dan status pekerjaan. Unggahan berkas adalah fitur baru yang belum tercakup dokumen mana pun, dan menyangkut keamanan (berkas dari pengguna), sehingga keputusannya dicatat di sini.

## Keputusan

1. **Kolom pekerjaan.** `start_date` (tanggal mulai), `end_date` (tanggal selesai), `description` (maksimal 2000 karakter), `status` (belum, berjalan, selesai, tertunda). Keduanya tanggal opsional; bila keduanya diisi, tanggal selesai tidak boleh sebelum tanggal mulai (dicek di server dan database).
   - **Tanggal selesai = tanggal TARGET selesai** (menggantikan kolom `due_date`, diganti nama lewat migrasi `004` sehingga data lama utuh). Tanggal inilah yang menentukan "terlambat" (status bukan selesai dan tanggal selesai sudah lewat) dan "tenggat terdekat" di beranda. *Konfirmasi:* bila yang dimaksud tanggal selesai AKTUAL, perlu kolom terpisah.
2. **Bukti unggahan (opsional).**
   - Jenis: **JPG, PNG, WebP, PDF**. Jenis ditentukan dari **isi berkas** (tanda awal/magic bytes), bukan dari nama atau Content-Type; berkas yang menyamar ditolak (422).
   - Ukuran **≤ 5 MB** per berkas (413 bila lebih), **maksimal 5 berkas per pekerjaan** (409; ditegakkan dengan kunci baris agar unggahan serentak tidak melampauinya).
   - Dikirim sebagai **isi mentah** (tanpa multipart), mengikuti pola impor CSV: **tanpa dependensi baru**. Nama berkas dari klien hanya dipakai sebagai nama tampilan setelah dibersihkan (tanpa jalur/simbol berbahaya, ekstensi dipaksa sesuai jenis hasil deteksi).
   - Disimpan di **PostgreSQL (`BYTEA`)**, bukan di folder web: tidak ada jalur berkas yang dapat ditebak atau disajikan statis, ikut tercadangkan bersama database, dan terhapus otomatis bersama pekerjaannya.
   - Disajikan hanya lewat API yang memeriksa sesi dan divisi: gambar dibuka di tab (`inline`), **PDF diunduh (`attachment`)**; selalu dengan `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox; default-src 'none'`, dan `Cache-Control: private, no-store`.
   - Pembatasan laju unggah: 30 permintaan per 10 menit; wajib CSRF; tindakan tambah/hapus dicatat di log audit (tanpa isi berkas).
3. **Hak akses** (menyempurnakan tabel D46):

   | | Koordinator divisi sendiri | Koordinator divisi lain | Ketua | Superadmin |
   |---|---|---|---|---|
   | Judul, status, tanggal, **deskripsi**, jumlah catatan dan bukti | lihat + ubah | **lihat saja** | lihat | lihat + ubah |
   | **Isi catatan** dan **berkas bukti** (daftar, buka, unduh) | lihat + tulis/unggah/hapus | **tidak** (403) | lihat | lihat + tulis/unggah/hapus |

   *Konfirmasi:* deskripsi dibuat terlihat oleh divisi lain karena dianggap rincian pekerjaan (setara judul), sedangkan catatan progres dan bukti dianggap internal. Bila deskripsi juga ingin disembunyikan dari divisi lain, itu perubahan kecil.
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
