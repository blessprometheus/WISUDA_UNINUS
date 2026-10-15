/** Klien API sisi-browser: menangani cookie CSRF, JSON, dan bentuk respons { success, data | message }. */

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
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

export async function api<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  retried = false,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (method !== "GET") {
    if (!readCookie("XSRF-TOKEN")) await refreshCsrf();
    headers["X-XSRF-TOKEN"] = readCookie("XSRF-TOKEN") ?? "";
    headers["Content-Type"] = "application/json";
  }
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: "same-origin",
      cache: "no-store",
      // POST selalu membawa isi JSON (minimal {}): Fastify menolak Content-Type JSON dengan isi kosong.
      ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
    });
  } catch {
    return { ok: false, status: 0, message: "Tidak dapat terhubung ke server." };
  }
  // Token CSRF kedaluwarsa: ambil yang baru lalu coba sekali lagi.
  if (response.status === 419 && !retried) {
    await refreshCsrf();
    return api<T>(method, path, body, true);
  }
  let payload: { data?: T; message?: string } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    // respons bukan JSON
  }
  return {
    ok: response.ok,
    status: response.status,
    ...(payload.data === undefined ? {} : { data: payload.data }),
    ...(payload.message === undefined ? {} : { message: payload.message }),
  };
}

export type Role = "superadmin" | "petugas" | "koordinator" | "ketua";

export interface Profile {
  user: { id: number; name: string; email: string; role: Role };
  mfa: { verified: boolean; enabled: boolean; setup_required: boolean };
}

/** Hanya terima jalur internal untuk parameter `next` (cegah open redirect). */
export function safeNext(value: string | null, fallback: string): string {
  return value && /^\/[A-Za-z0-9/_-]*$/.test(value) && !value.startsWith("//") ? value : fallback;
}
