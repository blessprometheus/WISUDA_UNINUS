# ADR-0005: Pemindaian memakai scanner USB di laptop petugas, mode online

- **Status:** Diterima (detail perangkat *Pending* verifikasi)
- **Tanggal:** 14 Oktober 2026

## Konteks

Pemilik proyek menyatakan: panitia memiliki **4 unit alat scan**, **4 petugas**, petugas memakai **laptop**, dan lokasi disebut memiliki jaringan yang andal. **Lokasi gladi dan hari-H belum ditentukan**, jadi klaim jaringan belum dapat diverifikasi.

## Keputusan

1. Halaman pemindai adalah **halaman web biasa** yang dibuka di laptop petugas. Scanner USB/Bluetooth bekerja sebagai perangkat keyboard (*HID keyboard wedge*): hasil scan masuk ke kolom input yang selalu fokus, diakhiri Enter. **Tidak perlu akses kamera, PWA, atau mode offline.**
2. Pemindaian **online**: server memvalidasi token saat itu juga.
3. 4 titik scan berjalan bersamaan. Pencegahan scan ganda ditangani **database** (constraint unik per wisudawan per sesi), bukan logika di browser.
4. Layar petugas menampilkan **nama, program studi, dan status** (berhasil / sudah hadir / tidak dikenal) dengan warna dan teks yang jelas, serta bunyi/umpan balik yang bisa dikenali dari jauh.
5. Jaringan dianggap **risiko yang belum terverifikasi** sampai lokasi ditentukan. Absensi manual tetap menjadi cadangan (ADR-0003).

## Konsekuensi untuk format QR (menyempurnakan ADR-0004 poin 1)

Karena scan selalu online, token QR **tidak perlu ditandatangani**. Cukup **token acak pendek yang dicari di database** (tidak bisa ditebak, tidak memuat NIM). Token pendek juga membuat kode lebih mudah dibaca scanner. Tingkat keamanannya setara dengan token bertanda tangan untuk kasus pemakaian ini.

## Pembaruan (D10, 14 Oktober 2026): jenis kode & cadangan input manual

Pemilik proyek mengonfirmasi scanner **dapat membaca QR dari layar HP**, dan tahun lalu wisudawan umumnya menunjukkan kode dari layar HP. Bila kode sulit terbaca, panitia memasukkan **NIM secara manual**. Maka:

1. Kode yang dihasilkan adalah **QR** (bukan barcode 1D). Wisudawan mengunduhnya sebagai **gambar** (PNG) sehingga dapat ditampilkan dari galeri HP **tanpa internet** di lokasi.
2. Halaman pemindai menyediakan **input NIM manual** sebagai bagian dari fitur (bukan jalan pintas di luar sistem), sehingga cadangan pun tercatat di rekap.
3. Setiap catatan kehadiran menyimpan **metode** (`scan` / `manual`), **petugas**, dan **waktu**, agar rekap dapat diaudit dan penggunaan input manual yang tidak wajar terlihat.
4. Input manual setara dengan pencocokan identitas oleh petugas: layar tetap menampilkan nama dan prodi untuk dikonfirmasi sebelum dicatat.

## Pembaruan (D17, 14 Oktober 2026): NIM tidak ditemukan & tanpa pemeriksaan identitas

- Kasus NIM tidak ada di sistem dinilai **jarang**; kendala yang lazim adalah QR tidak terbaca, yang ditangani input NIM manual (di atas), seperti pada PKKMB.
- Bila NIM manual **tidak ditemukan**, layar pemindai menampilkan pesan jelas dan menyediakan pencatatan **"tidak terdaftar"** (nama + NIM yang diketik, petugas, waktu). Entri ini **tidak dihitung sebagai kehadiran** dan tidak ada alur persetujuan; ditinjau superadmin setelah acara.
- **Tidak ada pemeriksaan KTM/KTP** di pintu masuk (keputusan pemilik proyek). Akibatnya input NIM manual hanya dapat diaudit lewat log (metode, petugas, waktu), tidak diverifikasi terhadap identitas fisik. Risiko ini menambah risiko ADR-0004 dan diterima pemilik proyek.

## Syarat yang masih harus diverifikasi

- Mode scanner harus **HID keyboard** dengan suffix Enter; jika mode lain, dikonfigurasi lewat barcode pengaturan dari pabrikan. Diuji dengan halaman uji sebelum gladi.
- Uji baca QR dari berbagai layar HP (kecerahan rendah, layar retak, casing kaca) sebelum hari-H.

## Alternatif yang ditolak

- **PWA offline di HP** — tidak dibutuhkan karena perangkat sudah ada dan jaringan dinyatakan andal.
- **Kamera laptop/HP** — lebih lambat dan kurang andal untuk antrean padat dibanding scanner khusus.

## Konsekuensi

- Scan berhasil/gagal tidak bergantung pada kualitas kamera, tetapi bergantung pada kualitas jaringan dan **kapasitas server untuk 4 titik scan** (beban ringan).
- Gladi resik menjadi **uji lapangan wajib** untuk jaringan dan scanner; hasilnya menentukan perlu tidaknya opsi offline sebelum hari-H.
