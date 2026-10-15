import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import QRCode from "qrcode";

import { audit } from "../audit.js";
import { config } from "../config.js";
import { issueCsrfCookie, verifyCsrf } from "../auth/csrf.js";
import { requireAuth } from "../auth/guard.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { decryptSecret, encryptSecret } from "../auth/secrets.js";
import {
  ALL_ROLES,
  PENDING_MINUTES,
  createSession,
  getAuth,
  revokeCurrentSession,
  sessionLifetimeMinutes,
  type AuthContext,
  type Role,
} from "../auth/session.js";
import {
  generateRecoveryCodes,
  newTotpSecret,
  otpauthUrl,
  recoveryCodeHash,
  verifyTotp,
} from "../auth/totp.js";
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
  totp_secret_enc: string | null;
  totp_enabled: boolean;
  totp_last_step: number | null;
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

async function loadUser(userId: number): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `SELECT id, name, email, role, password_hash, is_active, totp_secret_enc, totp_enabled,
            totp_last_step, failed_logins, locked_until
       FROM users WHERE id = $1 AND is_active = TRUE`,
    [userId],
  );
  return result.rows[0] ?? null;
}

function isLocked(user: UserRow): boolean {
  return user.locked_until !== null && user.locked_until.getTime() > Date.now();
}

function profile(auth: AuthContext) {
  const setupRequired =
    config.require2faForSuperadmin && auth.user.role === "superadmin" && !auth.user.totpEnabled;
  return {
    user: {
      id: auth.user.id,
      name: auth.user.name,
      email: auth.user.email,
      role: auth.user.role,
    },
    mfa: {
      verified: auth.mfaVerified,
      enabled: auth.user.totpEnabled,
      setup_required: setupRequired,
    },
  };
}

/** Ganti sesi (anti session-fixation) setelah perubahan tingkat kepercayaan. */
async function rotateSession(
  request: FastifyRequest,
  reply: FastifyReply,
  auth: AuthContext,
): Promise<void> {
  await revokeCurrentSession(request, reply);
  await createSession(auth.user.id, sessionLifetimeMinutes(auth.user.role), true, reply);
}

async function consumeSecondFactor(user: UserRow, code: string): Promise<boolean> {
  const trimmed = code.trim();
  if (/^[0-9]{6}$/.test(trimmed)) {
    if (!user.totp_secret_enc) return false;
    const step = verifyTotp(decryptSecret(user.totp_secret_enc), trimmed);
    if (step === null) return false;
    // Atomik: kode pada langkah waktu yang sama atau lebih lama ditolak (anti-replay).
    const result = await pool.query(
      `UPDATE users SET totp_last_step = $2
        WHERE id = $1 AND (totp_last_step IS NULL OR totp_last_step < $2)`,
      [user.id, step],
    );
    return (result.rowCount ?? 0) === 1;
  }
  if (/^[A-Za-z0-9\s-]{10,13}$/.test(trimmed)) {
    const result = await pool.query(
      `UPDATE recovery_codes SET used_at = NOW()
        WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL`,
      [user.id, recoveryCodeHash(trimmed)],
    );
    return (result.rowCount ?? 0) === 1;
  }
  return false;
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
        `SELECT id, name, email, role, password_hash, is_active, totp_secret_enc, totp_enabled,
                totp_last_step, failed_logins, locked_until
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
      const setupRequired =
        config.require2faForSuperadmin && user.role === "superadmin" && !user.totp_enabled;
      const mfaVerified = !user.totp_enabled && !setupRequired;
      const minutes = mfaVerified ? sessionLifetimeMinutes(user.role) : PENDING_MINUTES;
      await createSession(user.id, minutes, mfaVerified, reply);
      await audit(request, user.id, "login_ok", { detail: { mfa_verified: mfaVerified } });
      return ok(reply, {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        mfa: { verified: mfaVerified, enabled: user.totp_enabled, setup_required: setupRequired },
      });
    },
  );

  app.post(
    "/api/v1/auth/2fa/verify",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const auth = await requireAuth(request, reply, ALL_ROLES, {
        mutation: true,
        allowUnverified: true,
      });
      if (!auth) return reply;
      if (auth.mfaVerified) return ok(reply, profile(auth));
      const user = await loadUser(auth.user.id);
      if (!user || !user.totp_enabled) return fail(reply, 409, "2FA belum diaktifkan.");
      if (isLocked(user)) {
        return fail(reply, 429, "Terlalu banyak percobaan gagal. Coba lagi beberapa saat.");
      }
      const accepted = await consumeSecondFactor(user, text(request.body, "code", 20));
      if (!accepted) {
        await registerFailure(user.id);
        await audit(request, user.id, "2fa_failed");
        return fail(reply, 401, "Kode verifikasi salah atau sudah dipakai.");
      }
      await pool.query("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1", [
        user.id,
      ]);
      await rotateSession(request, reply, auth);
      await audit(request, user.id, "2fa_ok");
      return ok(reply, {
        ...profile({ ...auth, mfaVerified: true }),
      });
    },
  );

  app.post(
    "/api/v1/auth/2fa/setup",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const auth = await requireAuth(request, reply, ALL_ROLES, {
        mutation: true,
        allowUnverified: true,
      });
      if (!auth) return reply;
      const user = await loadUser(auth.user.id);
      if (!user) return fail(reply, 401, "Sesi telah berakhir. Silakan masuk kembali.");
      // Sesi yang belum lolos 2FA TIDAK boleh mengganti rahasia 2FA yang sudah aktif.
      if (user.totp_enabled) return fail(reply, 409, "2FA sudah aktif.");
      const secret = newTotpSecret();
      await pool.query(
        "UPDATE users SET totp_secret_enc = $2, totp_last_step = NULL WHERE id = $1",
        [user.id, encryptSecret(secret)],
      );
      const url = otpauthUrl(secret, user.email);
      await audit(request, user.id, "2fa_setup_started");
      return ok(reply, {
        secret,
        otpauth_url: url,
        qr_data_url: await QRCode.toDataURL(url, { margin: 1, width: 240 }),
      });
    },
  );

  app.post(
    "/api/v1/auth/2fa/confirm",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const auth = await requireAuth(request, reply, ALL_ROLES, {
        mutation: true,
        allowUnverified: true,
      });
      if (!auth) return reply;
      const user = await loadUser(auth.user.id);
      if (!user || user.totp_enabled || !user.totp_secret_enc) {
        return fail(reply, 409, "Mulai pendaftaran 2FA terlebih dahulu.");
      }
      const code = text(request.body, "code", 20).trim();
      const step = /^[0-9]{6}$/.test(code)
        ? verifyTotp(decryptSecret(user.totp_secret_enc), code)
        : null;
      if (step === null) return fail(reply, 401, "Kode verifikasi salah.");

      const codes = generateRecoveryCodes();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          "UPDATE users SET totp_enabled = TRUE, totp_last_step = $2 WHERE id = $1",
          [user.id, step],
        );
        await client.query("DELETE FROM recovery_codes WHERE user_id = $1", [user.id]);
        for (const recovery of codes) {
          await client.query("INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1, $2)", [
            user.id,
            recoveryCodeHash(recovery),
          ]);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      await rotateSession(request, reply, auth);
      await audit(request, user.id, "2fa_enabled");
      return ok(reply, {
        recovery_codes: codes,
        notice: "Simpan kode pemulihan ini di tempat aman. Kode tidak akan ditampilkan lagi.",
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
    const auth = await requireAuth(request, reply, ALL_ROLES, {
      mutation: true,
      allowUnverified: true,
    });
    if (!auth) return reply;
    await revokeCurrentSession(request, reply);
    await audit(request, auth.user.id, "logout");
    return ok(reply, { message: "Berhasil keluar." });
  });
}
