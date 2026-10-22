import type { FastifyInstance } from "fastify";

import { audit } from "../audit.js";
import { requireAuth } from "../auth/guard.js";
import { generatePassword, hashPassword } from "../auth/password.js";
import { ALL_ROLES, revokeAllSessions, type Role } from "../auth/session.js";
import { pool } from "../db.js";
import { fail, ok } from "../http.js";
import { body, pageMeta, pagination, params, positiveId, query, str } from "../lib/params.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function activeSuperadminCount(): Promise<number> {
  const result = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM users WHERE role = 'superadmin' AND is_active",
  );
  return result.rows[0]?.n ?? 0;
}

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/admin/users", async (request, reply) => {
    if (!(await requireAuth(request, reply, ["superadmin"]))) return reply;
    const result = await pool.query(
      `SELECT id, name, email, role, is_active, created_at
         FROM users ORDER BY created_at, id`,
    );
    return ok(reply, result.rows);
  });

  // Akun dibuat hanya oleh superadmin; tidak ada pendaftaran publik (ADR-0008).
  app.post("/api/v1/admin/users", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    const b = body(request);
    const name = str(b.name, 160);
    const email = str(b.email, 160).toLowerCase();
    const role = b.role as Role;
    if (!name || !EMAIL.test(email) || !ALL_ROLES.includes(role)) {
      return fail(reply, 422, "Isi nama, email yang valid, dan peran yang sah.");
    }
    // Hanya ada satu superadmin (pemilik proyek, dibuat lewat CLI). Peran ini tidak dapat dibuat dari dashboard.
    if (role === "superadmin") {
      return fail(reply, 422, "Akun superadmin tidak dapat dibuat dari dashboard.");
    }
    const password = generatePassword();
    try {
      const result = await pool.query<{ id: number }>(
        "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id",
        [name, email, await hashPassword(password), role],
      );
      const id = result.rows[0]!.id;
      await audit(request, auth.user.id, "user_created", {
        entity: "users",
        entityId: id,
        detail: { role },
      });
      // Kata sandi sementara hanya ditampilkan sekali; tidak pernah disimpan polos.
      return ok(reply.code(201), { id, email, role, temporary_password: password });
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        return fail(reply, 409, "Email sudah terdaftar.");
      throw error;
    }
  });

  app.post("/api/v1/admin/users/:id/deactivate", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    const id = positiveId(params(request).id);
    if (!id) return fail(reply, 422, "Pengguna tidak valid.");
    if (id === auth.user.id)
      return fail(reply, 409, "Anda tidak dapat menonaktifkan akun Anda sendiri.");
    const target = await pool.query<{ role: Role; is_active: boolean }>(
      "SELECT role, is_active FROM users WHERE id = $1",
      [id],
    );
    const row = target.rows[0];
    if (!row) return fail(reply, 404, "Pengguna tidak ditemukan.");
    if (row.role === "superadmin" && row.is_active && (await activeSuperadminCount()) <= 1) {
      return fail(reply, 409, "Tidak dapat menonaktifkan superadmin aktif terakhir.");
    }
    await pool.query("UPDATE users SET is_active = FALSE WHERE id = $1", [id]);
    await revokeAllSessions(id);
    await audit(request, auth.user.id, "user_deactivated", { entity: "users", entityId: id });
    return ok(reply, { id, is_active: false });
  });

  app.post("/api/v1/admin/users/:id/reactivate", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    const id = positiveId(params(request).id);
    if (!id) return fail(reply, 422, "Pengguna tidak valid.");
    const result = await pool.query(
      "UPDATE users SET is_active = TRUE, failed_logins = 0, locked_until = NULL WHERE id = $1",
      [id],
    );
    if (result.rowCount !== 1) return fail(reply, 404, "Pengguna tidak ditemukan.");
    await audit(request, auth.user.id, "user_reactivated", { entity: "users", entityId: id });
    return ok(reply, { id, is_active: true });
  });

  app.post("/api/v1/admin/users/:id/revoke-sessions", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    const id = positiveId(params(request).id);
    if (!id) return fail(reply, 422, "Pengguna tidak valid.");
    await revokeAllSessions(id);
    await audit(request, auth.user.id, "user_sessions_revoked", { entity: "users", entityId: id });
    return ok(reply, { id });
  });

  app.post("/api/v1/admin/users/:id/reset-password", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    const id = positiveId(params(request).id);
    if (!id) return fail(reply, 422, "Pengguna tidak valid.");
    const password = generatePassword();
    const result = await pool.query(
      "UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL WHERE id = $1",
      [id, await hashPassword(password)],
    );
    if (result.rowCount !== 1) return fail(reply, 404, "Pengguna tidak ditemukan.");
    await revokeAllSessions(id);
    await audit(request, auth.user.id, "user_password_reset", { entity: "users", entityId: id });
    return ok(reply, { id, temporary_password: password });
  });

  app.get("/api/v1/admin/audit-log", async (request, reply) => {
    if (!(await requireAuth(request, reply, ["superadmin"]))) return reply;
    const page = pagination(query(request), 50, 200);
    const [count, rows] = await Promise.all([
      pool.query<{ total: number }>("SELECT COUNT(*)::int AS total FROM audit_log"),
      pool.query(
        `SELECT l.id, l.action, l.entity, l.entity_id, l.detail, l.created_at, u.name AS user_name
           FROM audit_log l LEFT JOIN users u ON u.id = l.user_id
          ORDER BY l.id DESC LIMIT $1 OFFSET $2`,
        [page.perPage, page.offset],
      ),
    ]);
    return ok(reply, rows.rows, pageMeta(page, count.rows[0]?.total ?? 0));
  });
}
