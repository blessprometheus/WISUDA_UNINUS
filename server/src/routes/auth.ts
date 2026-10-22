import type { FastifyInstance } from "fastify";

import { audit } from "../audit.js";
import { config } from "../config.js";
import { issueCsrfCookie, verifyCsrf } from "../auth/csrf.js";
import { requireAuth } from "../auth/guard.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import {
  ALL_ROLES,
  createSession,
  getAuth,
  revokeCurrentSession,
  sessionLifetimeMinutes,
  type AuthContext,
  type Role,
} from "../auth/session.js";
import { pool } from "../db.js";
import { fail, ok } from "../http.js";

const MAX_FAILURES = 5;

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  password_hash: string;
  is_active: boolean;
  failed_logins: number;
  locked_until: Date | null;
}

function text(body: unknown, key: string, max: number): string {
  const value = (body as Record<string, unknown> | null)?.[key];
  return typeof value === "string" && value.length <= max ? value : "";
}

/** Penguncian bertahap: 5 gagal → 1 menit, lalu berlipat ganda hingga maksimal 60 menit. */
async function registerFailure(userId: number): Promise<void> {
  await pool.query(
    `UPDATE users
        SET failed_logins = failed_logins + 1,
            locked_until = CASE WHEN failed_logins + 1 >= $2
              THEN NOW() + make_interval(mins => LEAST(60, power(2, failed_logins + 1 - $2)::int))
              ELSE locked_until END
      WHERE id = $1`,
    [userId, MAX_FAILURES],
  );
}

function isLocked(user: UserRow): boolean {
  return user.locked_until !== null && user.locked_until.getTime() > Date.now();
}

function profile(auth: AuthContext) {
  return {
    user: {
      id: auth.user.id,
      name: auth.user.name,
      email: auth.user.email,
      role: auth.user.role,
    },
  };
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // Hash pengisi agar waktu respons tidak membocorkan keberadaan email.
  const dummyHash = await hashPassword("kata-sandi-pengisi-hanya-untuk-waktu");

  app.get("/sanctum/csrf-cookie", async (_request, reply) => {
    issueCsrfCookie(reply);
    return reply.code(204).send();
  });

  app.post(
    "/api/v1/auth/login",
    { config: { rateLimit: { max: config.loginRateMax, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (!verifyCsrf(request, reply)) return reply;
      const email = text(request.body, "email", 160).trim().toLowerCase();
      const password = text(request.body, "password", 256);
      if (!email || !password) return fail(reply, 422, "Email atau kata sandi tidak valid.");

      const found = await pool.query<UserRow>(
        `SELECT id, name, email, role, password_hash, is_active, failed_logins, locked_until
           FROM users WHERE LOWER(email) = $1 AND is_active = TRUE`,
        [email],
      );
      const user = found.rows[0] ?? null;

      if (user && isLocked(user)) {
        await audit(request, user.id, "login_locked");
        return fail(reply, 429, "Terlalu banyak percobaan gagal. Coba lagi beberapa saat.");
      }

      const valid = await verifyPassword(password, user?.password_hash ?? dummyHash);
      if (!user || !valid) {
        if (user) await registerFailure(user.id);
        await audit(request, user?.id ?? null, "login_failed");
        return fail(reply, 401, "Email atau kata sandi salah.");
      }

      await pool.query("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1", [
        user.id,
      ]);
      // Ganti sesi lama (bila ada) agar cookie sebelum login tidak dapat dipakai ulang (anti session-fixation).
      await revokeCurrentSession(request, reply);
      await createSession(user.id, sessionLifetimeMinutes(user.role), reply);
      await audit(request, user.id, "login_ok");
      return ok(reply, {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
    },
  );

  app.get("/api/v1/auth/me", async (request, reply) => {
    const auth = await getAuth(request);
    return auth
      ? ok(reply, profile(auth))
      : fail(reply, 401, "Sesi telah berakhir. Silakan masuk kembali.");
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const auth = await requireAuth(request, reply, ALL_ROLES, { mutation: true });
    if (!auth) return reply;
    await revokeCurrentSession(request, reply);
    await audit(request, auth.user.id, "logout");
    return ok(reply, { message: "Berhasil keluar." });
  });
}
