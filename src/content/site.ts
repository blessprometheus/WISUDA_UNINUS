/**
 * Konten publik statis. Jangan mengisi detail acara di luar surat edaran atau
 * konfirmasi panitia. Tautan arsip yang belum pasti tetap `null`.
 */

export interface ArchiveLink {
  readonly label: string;
  /** `null` = tautan resmi belum dikonfirmasi (menunggu backup situs ke-69). */
  readonly href: string | null;
}

export const siteConfig = {
  name: "Wisuda ke-70 Universitas Islam Nusantara",
  shortName: "Wisuda ke-70",
  institution: "Universitas Islam Nusantara",
  /** Domain produksi; dipakai untuk metadataBase dan OG. */
  url: "https://wisuda.uninus.ac.id",
  description:
    "Informasi resmi Wisuda ke-70 Universitas Islam Nusantara (UNINUS) Bandung, Sabtu 5 Desember 2026.",
  eventDate: "Sabtu, 5 Desember 2026",
} as const;

export const archive69Links: readonly ArchiveLink[] = [
  {
    label: "Galeri Foto",
    href: null,
  },
  {
    label: "E-Book Wisuda",
    href: null,
  },
  {
    label: "Survei Kepuasan",
    href: "https://survei.wisuda.uninus.ac.id",
  },
];

export const officialLinks = [
  { label: "Instagram", href: "https://instagram.com/uninusbandung" },
  { label: "YouTube", href: "https://www.youtube.com/@uninusbandung" },
  { label: "uninus.ac.id", href: "https://uninus.ac.id" },
] as const;

/**
 * Saklar fitur "Cari NIM & unduh QR" (R2). Dibaca saat BUILD; default mati sehingga R1 tidak berubah.
 * Nyalakan hanya setelah API, database, dan data wisudawan siap (jadwal: QR dibuka ± 28 Nov 2026).
 */
export const qrEnabled = process.env.NEXT_PUBLIC_QR_ENABLED === "1";

/**
 * Saklar area staf (/masuk, /pemindai). Dibaca saat BUILD; default mati → rute-rute ini 404 dan R1 tidak berubah.
 * Dipisah dari saklar QR karena petugas perlu dicoba lebih awal daripada wisudawan.
 */
export const staffEnabled = process.env.NEXT_PUBLIC_STAFF_ENABLED === "1";

export const navLinks = [
  { label: "Informasi", href: "/#informasi" },
  ...(qrEnabled ? [{ label: "Kartu QR", href: "/#kartu-qr" }] : []),
  { label: "Arsip", href: "/arsip/69" },
  { label: "Kontak", href: "#kontak" },
] as const;
