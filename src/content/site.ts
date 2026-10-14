/**
 * Konten R1 (statis, bertipe). Sumber resmi detail acara adalah surat edaran panitia;
 * nilai yang belum pasti sengaja `null` dan ditampilkan sebagai "Segera diumumkan".
 * Jangan mengisi nilai di luar surat edaran / konfirmasi panitia.
 */

export interface InfoItem {
  readonly label: string;
  /** `null` = belum diumumkan. */
  readonly value: string | null;
}

export interface ArchiveLink {
  readonly label: string;
  readonly description: string;
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

export const infoItems: readonly InfoItem[] = [
  { label: "Tanggal", value: siteConfig.eventDate },
  { label: "Lokasi", value: null },
  { label: "Pendaftaran", value: null },
  { label: "Persyaratan & biaya", value: null },
];

export const archive69Links: readonly ArchiveLink[] = [
  {
    label: "Galeri Foto",
    description: "Dokumentasi Wisuda ke-69 per gelombang dan fakultas.",
    href: null,
  },
  {
    label: "E-Book Wisuda",
    description: "Buku kenangan digital Wisuda ke-69 (PDF).",
    href: null,
  },
  {
    label: "Survei Kepuasan",
    description: "Masukan wisudawan untuk penyelenggaraan berikutnya.",
    href: "https://survei.wisuda.uninus.ac.id",
  },
];

export const officialLinks = [
  { label: "Instagram", href: "https://instagram.com/uninusbandung" },
  { label: "YouTube", href: "https://www.youtube.com/@uninusbandung" },
  { label: "uninus.ac.id", href: "https://uninus.ac.id" },
] as const;

export const navLinks = [
  { label: "Informasi", href: "/#informasi" },
  { label: "Arsip", href: "/arsip/69" },
  { label: "Kontak", href: "#kontak" },
] as const;
