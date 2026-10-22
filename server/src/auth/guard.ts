import type { FastifyReply, FastifyRequest } from "fastify";

import { fail } from "../http.js";
import { verifyCsrf } from "./csrf.js";
import { getAuth, type AuthContext, type Role } from "./session.js";

interface GuardOptions {
  /** Wajib untuk endpoint yang mengubah data. */
  mutation?: boolean;
}

/**
 * Pemeriksaan satu pintu: sesi valid → peran diizinkan → CSRF (bila mutasi).
 * Mengembalikan null setelah mengirim galat; pemanggil cukup `return reply`.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  roles: readonly Role[],
  options: GuardOptions = {},
): Promise<AuthContext | null> {
  const auth = await getAuth(request);
  if (!auth) {
    fail(reply, 401, "Sesi telah berakhir. Silakan masuk kembali.");
    return null;
  }
  if (!roles.includes(auth.user.role)) {
    fail(reply, 403, "Anda tidak memiliki izin untuk mengakses data ini.");
    return null;
  }
  if (options.mutation && !verifyCsrf(request, reply)) return null;
  return auth;
}
