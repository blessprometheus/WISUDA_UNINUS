# ADR-0011: Animasi dengan Lenis (gulir halus) dan Motion

- **Status:** Diterima (atas permintaan pemilik proyek, 15 Oktober 2026)
- **Menyempurnakan:** [ADR-0001](0001-r1-nextjs-tanpa-database.md) ("animasi memakai CSS; Motion hanya bila diperlukan")

## Konteks

Pemilik proyek menginginkan teks "Wisuda ke-70" beranimasi dan nuansa gulir halus seperti lenis.dev, selaras dengan tujuan desain "ceremonial dan monumental".

## Keputusan

1. **Hero (konten paling atas) memakai CSS murni**: huruf "Wisuda ke-" muncul satu per satu dari topeng (`.rise`), **angka 70 berputar seperti odometer** (puluhan 0→7, satuan 0→9→0) lalu **berkilau emas sekali**, cahaya emas samar di belakang judul, elemen lain memudar naik (`.fade-up`), garis kubah tergambar (`stroke-dashoffset`). Alasan: tidak berkedip dan tidak bergantung pada JavaScript.
   - **`<h1>` berisi teks bersih "Wisuda ke-70" (`sr-only`)**; visual animasi berada di blok `aria-hidden` terpisah, agar mesin pencari, mode baca, dan salin-tempel tidak melihat deretan angka odometer.
   - Kilau memakai `filter` (bukan `background-clip: text`, yang gagal pada teks di dalam kolom `overflow: hidden` yang bergerak).
2. **Motion** (`motion`, `LazyMotion` + fitur dimuat tertunda) untuk: paralaks kubah saat digulir, dan `Reveal` (muncul saat bagian digulir masuk, sekali).
3. **Lenis** (`lenis`, < 5 KB) untuk gulir halus, termasuk tautan anchor. Scrollbar asli tidak diganti.
4. **Aksesibilitas — wajib:**
   - `prefers-reduced-motion: reduce` → Lenis tidak dijalankan, animasi CSS dimatikan, dan CSS menimpa gaya sebaris sehingga **tidak ada konten yang disembunyikan**.
   - Tanpa JavaScript → `<noscript>` membuat elemen `data-reveal` langsung terlihat; hero tetap tampil.
   - Konten selalu ada di HTML (bukan dibuat oleh JS).
5. Tidak ada animasi pada halaman petugas (`/masuk`, `/pemindai`): kecepatan dan keterbacaan lebih penting.

## Alternatif yang ditolak

- Semua animasi lewat Motion: elemen hero tersembunyi di HTML server sampai hidrasi → kedipan dan LCP lebih buruk.
- Animasi `animation-timeline: view()` murni CSS: belum didukung semua peramban.
- GSAP: lebih berat dan lisensinya lebih rumit untuk kebutuhan ini.

## Konsekuensi

- Dua dependensi produksi baru (`lenis`, `motion`); `npm audit --omit=dev` tetap 0 kerentanan.
- **Kompromi performa (terukur):** Lighthouse mobile pada pratinjau Performance 92–93 (sebelum animasi hero diperkaya: 99), Accessibility/Best Practices/SEO 100, CLS 0, TBT ≈ 100 ms. LCP simulasi Lighthouse 3,1–3,2 dtk (sebelumnya 1,7 dtk) karena elemen LCP-nya adalah angka odometer yang beranimasi; waktu render **nyata** pada trace hanya ≈ 0,33 dtk (TTFB 11 ms + render delay 323 ms). Angka simulasi memakai CPU 4× lebih lambat. Bila metrik LCP lab menjadi prioritas, animasi odometer dapat diganti dengan angka statis tanpa mengubah bagian lain.
- Perlu uji visual di perangkat nyata (belum dilakukan di HP fisik).

## Penyesuaian mobile (21 Oktober 2026)

**Keputusan:** Pada layar di bawah 768 px atau perangkat dengan pointer sentuh, situs memakai
gulir native. Lenis dimuat hanya pada layar desktop dengan pointer presisi dan tanpa preferensi
pengurangan gerakan. Paralaks kubah dan `Reveal` dihapus; garis kubah tetap tampil sebagai
dekorasi statis setelah animasi gambar awal. Dependensi Motion dilepas karena tidak lagi dipakai.
Pada mobile, seluruh isi hero langsung terlihat tanpa animasi pembuka; odometer menampilkan
angka akhir 70 dan kilau berfilter dimatikan. Konten informasi dan arsip langsung terlihat
tanpa hidrasi atau pemantau viewport.

**Alasan:** Mayoritas pengunjung akan memakai HP. Gulir native menghindari loop animasi yang
terus berjalan saat pengguna membaca informasi dan galeri. Pengujian visual dan rasa gulir di
perangkat HP fisik tetap diperlukan sebelum rilis.

## Informasi Wisuda muncul satu per satu saat digulir (23 Oktober 2026)

**Keputusan pemilik proyek:** Lenis hanya untuk halaman publik (frontend), dan bagian "Informasi Wisuda"
menampilkan informasinya **satu per satu saat digulir**. Hal ini tidak membatalkan penyesuaian mobile di atas.

**Implementasi:** komponen `RevealOnScroll` (CSS transisi + `IntersectionObserver` bawaan peramban,
**tanpa menambah dependensi**; Motion tetap tidak dipakai). Tiap baris informasi punya pemicunya sendiri dan
muncul sekali (opasitas + naik sedikit; isi menyusul sesaat setelah label).
- **Hanya desktop** dengan pointer presisi dan tanpa "kurangi gerakan", syarat yang sama dengan Lenis. Di desktop
  tiap baris dibuat besar dan diberi ruang gulir sendiri (± 34% tinggi layar) agar benar-benar muncul bergantian.
- **HP, layar sentuh, "kurangi gerakan", sebelum hidrasi, dan tanpa JavaScript:** semua informasi langsung terlihat
  dan tampilan tetap ringkas (konsisten dengan keputusan 21 Oktober).
- Isi selalu ada di HTML (hanya opasitas/posisi yang dianimasikan), sehingga mesin pencari dan pembaca layar tidak
  terpengaruh. Baris yang sudah terlihat saat halaman dimuat (mis. tiba lewat tombol "Lihat Informasi" atau muat
  ulang di tengah halaman) tidak disembunyikan.

**Terverifikasi di browser nyata:** baris muncul 0 → 1 → 2 → 3 → 4 → 5 mengikuti gulir dan tidak menghilang lagi;
tiba lewat "Lihat Informasi" menampilkan baris yang terlihat; "kurangi gerakan" dan HP menampilkan semua baris
(opasitas 1); teks lengkap ada di HTML mentah.
