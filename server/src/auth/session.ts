import { randomBytes } from "node:crypto";

import type { FastifyReply, FastifyRequest } from "fastify";

import { config } from "../config.js";
import { pool } from "../db.js";
import { sha256Hex } from "./secrets.js";

export type Role = "superadmin" | "petugas" | "koordinator" | "ketua";
export const ALL_ROLES: readonly Role[] = ["superadmin", "petugas", "koordinator", "ketua"];

export const SESSION_COOKIE = "wisuda_session";
/** Sesi yang belum lolos 2FA hanya hidup singkat. */
export const PENDING_MINUTES = 10;

/** Masa sesi per peran (D26). */
const LIFETIME_HOURS: Record<Role, number> = {
  petugas: 12,
  superadmin: 8,
  koordinator: 24 * 7,
  ketua: 24 * 7,
};

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  totpEnabled: boolean;
}

export interface AuthContext {
  user: AuthUser;
  sessionId: number;
  mfaVerified: boolean;
}

export function sessionLifetimeMinutes(role: Role): number {
  return LIFETIME_HOURS[role] * 60;
}

/** Buat sesi baru dan pasang cookie. Mengembalikan id sesi. */
export async function createSession(
  userId: number,
  minutes: number,
  mfaVerified: boolean,
  reply: FastifyReply,
): Promise<number> {
  const token = randomBytes(32).toString("hex");
  const result = await pool.query<{ id: number }>(
    `INSERT INTO user_sessions (user_id, token_hash, mfa_verified, expires_at)
     VALUES ($1, $2, $3, NOW() + make_interval(mins => $4)) RETURNING id`,
    [userId, sha256Hex(token), mfaVerified, minutes],
  );
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: minutes * 60,
  });
  return result.rows[0]!.id;
}

function readToken(request: FastifyRequest): string | null {
  const token = request.cookies[SESSION_COOKIE];
  return token && /^[0-9a-f]{64}$/.test(token) ? token : null;
}

export async function getAuth(request: FastifyRequest): Promise<AuthContext | null> {
  const token = readToken(request);
  if (!token) return null;
  const result = await pool.query<{
    session_id: number;
    mfa_verified: boolean;
    id: number;
    name: string;
    email: string;
    role: Role;
    totp_enabled: boolean;
  }>(
    `SELECT s.id AS session_id, s.mfa_verified, u.id, u.name, u.email, u.role, u.totp_enabled
       FROM user_sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.is_active = TRUE`,
    [sha256Hex(token)],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    sessionId: row.session_id,
    mfaVerified: row.mfa_verified,
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      totpEnabled: row.totp_enabled,
    },
  };
}

export async function revokeCurrentSession(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = readToken(request);
  if (token) {
    await pool.query("DELETE FROM user_sessions WHERE token_hash = $1", [sha256Hex(token)]);
  }
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function revokeAllSessions(userId: number): Promise<void> {
  await pool.query("DELETE FROM user_sessions WHERE user_id = $1", [userId]);
}

/** Hapus sesi kedaluwarsa (dipanggil berkala). */
export async function purgeExpiredSessions(): Promise<number> {
  const result = await pool.query("DELETE FROM user_sessions WHERE expires_at <= NOW()");
  return result.rowCount ?? 0;
}
