/**
 * Foto dari kamera HP biasanya 3-12 MB, melebihi batas bukti (5 MB). Foto yang lebih besar dari ambang dikecilkan di
 * peramban sebelum diunggah: sisi terpanjang maksimal 2400 px, dikodekan ulang sebagai JPEG kualitas 85% (umumnya
 * di bawah 1 MB, masih tajam untuk bukti). Orientasi foto dihormati, PNG transparan diberi latar putih, dan hasil
 * yang tidak lebih kecil dari aslinya tidak dipakai. Bila apa pun gagal, berkas asli dikembalikan apa adanya
 * (server tetap menolak yang melebihi batas). PDF tidak diubah.
 */
const SHRINK_ABOVE_BYTES = 1.5 * 1024 * 1024;
const MAX_SIDE = 2400;
const JPEG_QUALITY = 0.85;

function isPhoto(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return /^image\/(jpeg|png|webp)$/.test(file.type) || ["jpg", "jpeg", "png", "webp"].includes(ext);
}

export async function shrinkImage(file: File): Promise<File> {
  if (!isPhoto(file) || file.size <= SHRINK_ABOVE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
