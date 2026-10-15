# ADR-0011: Animasi dengan Lenis (gulir halus) dan Motion

- **Status:** Diterima (atas permintaan pemilik proyek, 15 Oktober 2026)
- **Menyempurnakan:** [ADR-0001](0001-r1-nextjs-tanpa-database.md) ("animasi memakai CSS; Motion hanya bila diperlukan")

## Konteks

Pemilik proyek menginginkan teks "Wisuda ke-70" beranimasi dan nuansa gulir halus seperti lenis.dev, selaras dengan tujuan desain "ceremonial dan monumental".

## Keputusan

1. **Hero (konten paling atas) memakai CSS murni**: teks terangkat dari topeng (`.rise`), elemen memudar naik (`.fade-up`), garis kubah tergambar (`stroke-dashoffset`). Alasan: tidak berkedip, tidak bergantung pada JavaScript, tidak menunda LCP.
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
- Terukur pada pratinjau: Lighthouse mobile Performance 99, Accessibility 100, LCP 1,7 dtk, TBT 130 ms, CLS 0.
- Perlu uji visual di perangkat nyata (belum dilakukan di HP fisik).
