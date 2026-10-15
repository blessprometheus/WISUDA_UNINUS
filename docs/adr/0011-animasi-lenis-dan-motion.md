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
