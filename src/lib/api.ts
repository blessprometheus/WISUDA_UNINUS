/** Klien API sisi-browser: menangani cookie CSRF, JSON, dan bentuk respons { success, data | message }. */

import { shrinkImage } from "@/lib/image";

export interface PageMeta {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  meta?: PageMeta;
  message?: string;
}

function readCookie(name: string): string | null {
  for (const part of document.cookie.split("; ")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index) === name)
      return decodeURIComponent(part.slice(index + 1));
  }
  return null;
}

async function refreshCsrf(): Promise<void> {
  await fetch("/sanctum/csrf-cookie", { credentials: "same-origin", cache: "no-store" });
}

interface RequestBody {
  /** Isi mentah (mis. CSV atau berkas bukti). Bila tidak ada, `json` dikirim sebagai JSON. */
  raw?: string | Blob;
  contentType?: string;
  extraHeaders?: Record<string, string>;
}

async function send<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  json: unknown,
  raw: RequestBody,
  retried: boolean,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { ...raw.extraHeaders };
  let payload: string | Blob | undefined;
  if (method !== "GET") {
    if (!readCookie("XSRF-TOKEN")) await refreshCsrf();
    headers["X-XSRF-TOKEN"] = readCookie("XSRF-TOKEN") ?? "";
    headers["Content-Type"] = raw.contentType ?? "application/json";
    // POST JSON selalu membawa isi (minimal {}): Fastify menolak Content-Type JSON dengan isi kosong.
    payload = raw.raw ?? JSON.stringify(json ?? {});
  }
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: "same-origin",
      cache: "no-store",
      ...(payload === undefined ? {} : { body: payload }),
    });
  } catch {
    return { ok: false, status: 0, message: "Tidak dapat terhubung ke server." };
  }
  // Token CSRF kedaluwarsa: ambil yang baru lalu coba sekali lagi.
  if (response.status === 419 && !retried) {
    await refreshCsrf();
    return send<T>(method, path, json, raw, true);
  }
  let body: { data?: T; meta?: PageMeta; message?: string } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    // respons bukan JSON
  }
  return {
    ok: response.ok,
    status: response.status,
    ...(body.data === undefined ? {} : { data: body.data }),
    ...(body.meta === undefined ? {} : { meta: body.meta }),
    ...(body.message === undefined ? {} : { message: body.message }),
  };
}

export function api<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  return send<T>(method, path, body, {}, false);
}

export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
const EVIDENCE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

/**
 * Unggah berkas bukti pekerjaan (foto JPG/PNG/WebP atau PDF; maks. 5 MB). Foto besar dikecilkan otomatis lebih dulu
 * (lihat `shrinkImage`). Pemeriksaan di sini hanya untuk pesan cepat; server menentukan jenis dari ISI berkas dan
 * menolak yang tidak sesuai.
 */
export async function uploadEvidence<T>(taskId: number, original: File): Promise<ApiResult<T>> {
  const refuse = (message: string): ApiResult<T> => ({ ok: false, status: 0, message });
  if (!EVIDENCE_TYPES[original.name.split(".").pop()?.toLowerCase() ?? ""]) {
    return refuse("Jenis berkas tidak didukung. Gunakan JPG, PNG, WebP, atau PDF.");
  }
  const file = await shrinkImage(original);
  const type = EVIDENCE_TYPES[file.name.split(".").pop()?.toLowerCase() ?? ""];
  if (!type) return refuse("Jenis berkas tidak didukung. Gunakan JPG, PNG, WebP, atau PDF.");
  if (file.size === 0) return refuse("Berkas kosong.");
  if (file.size > EVIDENCE_MAX_BYTES) {
    return refuse(
      "Ukuran berkas maksimal 5 MB. Foto dikecilkan otomatis; untuk PDF, kecilkan dulu ukurannya.",
    );
  }
  return send<T>(
    "POST",
    `/api/v1/timeline/tasks/${taskId}/evidence`,
    undefined,
    {
      raw: file,
      contentType: type,
      extraHeaders: { "X-Filename": encodeURIComponent(file.name).slice(0, 200) },
    },
    false,
  );
}

/** Unggah isi berkas CSV (teks) ke endpoint impor. */
export function uploadCsv<T>(path: string, csv: string, filename: string): Promise<ApiResult<T>> {
  return send<T>(
    "POST",
    path,
    undefined,
    {
      raw: csv,
      contentType: "text/csv",
      // Header HTTP hanya boleh ASCII: nama berkas dikodekan.
      extraHeaders: { "X-Filename": encodeURIComponent(filename).slice(0, 200) },
    },
    false,
  );
}

/**
 * Navigasi penuh (muat ulang halaman). Dipakai saat login/logout karena Next.js mempertahankan state
 * halaman sebelumnya; muat ulang membuang seluruh state klien (kode pemulihan, data petugas, dsb.).
 */
export function hardNavigate(url: string): void {
  window.location.assign(url);
}

export type Role = "superadmin" | "petugas" | "koordinator" | "ketua";

export interface Profile {
  user: { id: number; name: string; email: string; role: Role };
}

/** Hanya terima jalur internal untuk parameter `next` (cegah open redirect). */
export function safeNext(value: string | null, fallback: string): string {
  return value && /^\/[A-Za-z0-9/_-]*$/.test(value) && !value.startsWith("//") ? value : fallback;
}
