import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { FastifyReply, FastifyRequest } from "fastify";

import { config } from "../config.js";
import { fail } from "../http.js";

const COOKIE = "XSRF-TOKEN";
const MAX_AGE_SECONDS = 12 * 60 * 60;

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function signature(token: string): string {
  return createHmac("sha256", config.sessionSecret).update(`csrf:${token}`).digest("hex");
}

/** Cookie CSRF bertanda tangan (double-submit). Dapat dibaca JS agar dikirim ulang sebagai header. */
export function issueCsrfCookie(reply: FastifyReply): void {
  const token = randomBytes(24).toString("hex");
  reply.setCookie(COOKIE, `${token}.${signature(token)}`, {
    httpOnly: false,
    secure: config.secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Wajib untuk semua permintaan yang mengubah data. Mengembalikan false setelah mengirim galat. */
export function verifyCsrf(request: FastifyRequest, reply: FastifyReply): boolean {
  const origin = request.headers.origin || request.headers.referer;
  if (origin) {
    try {
      if (new URL(origin).origin !== config.publicOrigin) {
        fail(reply, 403, "Asal permintaan tidak diizinkan.");
        return false;
      }
    } catch {
      fail(reply, 403, "Asal permintaan tidak valid.");
      return false;
    }
  }

  const cookie = request.cookies[COOKIE];
  const header = request.headers["x-xsrf-token"];
  const headerValue = Array.isArray(header) ? header[0] : header;
  if (!cookie || !headerValue || !safeEqual(cookie, headerValue)) {
    fail(reply, 419, "Sesi keamanan berakhir. Muat ulang halaman dan coba lagi.");
    return false;
  }
  const [token, sig] = cookie.split(".");
  if (!token || !sig || !safeEqual(signature(token), sig)) {
    fail(reply, 419, "Sesi keamanan berakhir. Muat ulang halaman dan coba lagi.");
    return false;
  }
  return true;
}
