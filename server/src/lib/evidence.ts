/** Aturan berkas bukti pekerjaan (D50). Jenis ditentukan dari ISI berkas (tanda awal), bukan dari nama atau Content-Type. */

export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
export const MAX_EVIDENCE_PER_TASK = 5;

export interface EvidenceType {
  mime: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  ext: "jpg" | "png" | "webp" | "pdf";
}

/** Mengenali JPEG, PNG, WebP, dan PDF dari byte awal; selain itu null. */
export function detectEvidenceType(data: Buffer): EvidenceType | null {
  if (data.length < 12) return null;
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff)
    return { mime: "image/jpeg", ext: "jpg" };
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    data.subarray(0, 4).toString("latin1") === "RIFF" &&
    data.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  if (data.subarray(0, 5).toString("latin1") === "%PDF-")
    return { mime: "application/pdf", ext: "pdf" };
  return null;
}

/**
 * Nama tampilan yang aman: tanpa jalur, tanpa karakter kontrol atau simbol aneh, maksimal 100 karakter,
 * dan ekstensi disesuaikan dengan jenis hasil deteksi (nama dari klien tidak dipercaya).
 */
export function safeEvidenceName(raw: unknown, type: EvidenceType): string {
  let name = "";
  if (typeof raw === "string") {
    try {
      name = decodeURIComponent(raw);
    } catch {
      name = raw;
    }
  }
  name = name.split(/[\\/]/).at(-1) ?? "";
  name = name
    .replace(/[^\p{L}\p{N} ._()-]+/gu, "_")
    .replace(/^[.\s_]+/, "")
    .trim();
  const dot = name.lastIndexOf(".");
  const stem = (dot > 0 ? name.slice(0, dot) : name).slice(0, 90).trim();
  return `${stem || "bukti"}.${type.ext}`;
}
