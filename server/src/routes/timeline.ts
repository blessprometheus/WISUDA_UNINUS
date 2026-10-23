import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { audit } from "../audit.js";
import { requireAuth } from "../auth/guard.js";
import type { AuthContext, Role } from "../auth/session.js";
import { pool } from "../db.js";
import { fail, ok } from "../http.js";
import { body, params, positiveId, query, str } from "../lib/params.js";

const READ_ROLES: readonly Role[] = ["superadmin", "ketua", "koordinator"];
const WRITE_ROLES: readonly Role[] = ["superadmin", "koordinator"];
const STATUSES = ["belum", "berjalan", "selesai", "tertunda"] as const;
type Status = (typeof STATUSES)[number];

const TODAY_WIB = "(NOW() AT TIME ZONE 'Asia/Jakarta')::date";

/** Ekspresi "divisi ini boleh diubah pemakai": superadmin ($1) atau koordinator yang ditugaskan ($2 = id pemakai). */
const MINE =
  "($1::boolean OR EXISTS (SELECT 1 FROM user_divisions ud WHERE ud.division_id = d.id AND ud.user_id = $2))";

/**
 * Menulis dan membaca ISI catatan: superadmin dan ketua semua divisi; koordinator hanya divisi yang ditugaskan padanya.
 * (Daftar pekerjaan dan laporan progres dapat dibaca semua peran pembaca, lihat D46.)
 */
async function canSeeDivision(auth: AuthContext, divisionId: number): Promise<boolean> {
  if (auth.user.role !== "koordinator") return true;
  const result = await pool.query(
    "SELECT 1 FROM user_divisions WHERE user_id = $1 AND division_id = $2",
    [auth.user.id, divisionId],
  );
  return (result.rowCount ?? 0) === 1;
}

async function taskDivision(taskId: number): Promise<number | null> {
  const result = await pool.query<{ division_id: number }>(
    "SELECT division_id FROM tasks WHERE id = $1",
    [taskId],
  );
  return result.rows[0]?.division_id ?? null;
}

function parseDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    return undefined;
  }
  return value;
}

function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

/** Untuk koordinator yang mencoba divisi lain, jawaban sengaja sama dengan "tidak ditemukan". */
async function guardDivision(
  request: FastifyRequest,
  reply: FastifyReply,
  roles: readonly Role[],
  divisionId: number | null,
  mutation: boolean,
): Promise<AuthContext | null> {
  const auth = await requireAuth(request, reply, roles, { mutation });
  if (!auth) return null;
  if (!divisionId) {
    fail(reply, 422, "Divisi tidak valid.");
    return null;
  }
  if (!(await canSeeDivision(auth, divisionId))) {
    fail(reply, 403, "Anda tidak memiliki akses ke divisi ini.");
    return null;
  }
  return auth;
}

export async function registerTimelineRoutes(app: FastifyInstance): Promise<void> {
  // ---------- Divisi ----------
  app.get("/api/v1/timeline/divisions", async (request, reply) => {
    const auth = await requireAuth(request, reply, READ_ROLES);
    if (!auth) return reply;
    // Semua peran pembaca melihat semua divisi (D46); `mine` menandai divisi yang boleh ia ubah.
    const result = await pool.query(
      `SELECT d.id, d.name,
              COUNT(t.id)::int AS total,
              COUNT(t.id) FILTER (WHERE t.status = 'selesai')::int AS selesai,
              COUNT(t.id) FILTER (WHERE t.status = 'berjalan')::int AS berjalan,
              COUNT(t.id) FILTER (WHERE t.status = 'tertunda')::int AS tertunda,
              COUNT(t.id) FILTER (WHERE t.status = 'belum')::int AS belum,
              COUNT(t.id) FILTER (WHERE t.status <> 'selesai' AND t.due_date < ${TODAY_WIB})::int AS terlambat,
              ${MINE} AS mine
         FROM divisions d
         LEFT JOIN tasks t ON t.division_id = d.id
        GROUP BY d.id ORDER BY d.name`,
      [auth.user.role === "superadmin", auth.user.id],
    );
    return ok(reply, result.rows);
  });

  // ---------- Pekerjaan ----------
  app.get("/api/v1/timeline/tasks", async (request, reply) => {
    const divisionId = positiveId(query(request).division_id);
    // Daftar pekerjaan (judul, status, tenggat, jumlah catatan) dapat dilihat semua peran pembaca (D46).
    const auth = await requireAuth(request, reply, READ_ROLES);
    if (!auth) return reply;
    if (!divisionId) return fail(reply, 422, "Divisi tidak valid.");
    const result = await pool.query(
      `SELECT t.id, t.division_id, t.title, t.status, to_char(t.due_date, 'YYYY-MM-DD') AS due_date,
              (t.status <> 'selesai' AND t.due_date < ${TODAY_WIB}) AS overdue,
              t.updated_at, (SELECT COUNT(*)::int FROM task_notes n WHERE n.task_id = t.id) AS note_count
         FROM tasks t WHERE t.division_id = $1
        ORDER BY (t.status = 'selesai'), t.due_date NULLS LAST, t.id`,
      [divisionId],
    );
    return ok(reply, result.rows);
  });

  app.post("/api/v1/timeline/tasks", async (request, reply) => {
    const b = body(request);
    const divisionId = positiveId(b.division_id);
    const auth = await guardDivision(request, reply, WRITE_ROLES, divisionId, true);
    if (!auth) return reply;
    const title = str(b.title, 200);
    const status = b.status === undefined ? "belum" : b.status;
    const due = parseDate(b.due_date);
    if (!title || !isStatus(status) || due === undefined)
      return fail(reply, 422, "Isi judul, status, dan tenggat yang valid.");
    const result = await pool.query<{ id: number }>(
      "INSERT INTO tasks (division_id, title, status, due_date, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [divisionId, title, status, due, auth.user.id],
    );
    const id = result.rows[0]!.id;
    await audit(request, auth.user.id, "task_created", { entity: "tasks", entityId: id });
    return ok(reply.code(201), { id });
  });

  app.put("/api/v1/timeline/tasks/:id", async (request, reply) => {
    const id = positiveId(params(request).id);
    const divisionId = id ? await taskDivision(id) : null;
    if (id && !divisionId) return fail(reply, 404, "Pekerjaan tidak ditemukan.");
    const auth = await guardDivision(request, reply, WRITE_ROLES, divisionId, true);
    if (!auth || !id) return reply;
    const b = body(request);
    const title = str(b.title, 200);
    const due = parseDate(b.due_date);
    if (!title || !isStatus(b.status) || due === undefined)
      return fail(reply, 422, "Isi judul, status, dan tenggat yang valid.");
    await pool.query(
      "UPDATE tasks SET title = $2, status = $3, due_date = $4, updated_at = NOW() WHERE id = $1",
      [id, title, b.status, due],
    );
    await audit(request, auth.user.id, "task_updated", {
      entity: "tasks",
      entityId: id,
      detail: { status: b.status },
    });
    return ok(reply, { id });
  });

  app.post("/api/v1/timeline/tasks/:id/delete", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    const id = positiveId(params(request).id);
    if (!id) return fail(reply, 422, "Pekerjaan tidak valid.");
    const result = await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
    if (result.rowCount !== 1) return fail(reply, 404, "Pekerjaan tidak ditemukan.");
    await audit(request, auth.user.id, "task_deleted", { entity: "tasks", entityId: id });
    return ok(reply, { id });
  });

  // ---------- Catatan progres ----------
  app.get("/api/v1/timeline/tasks/:id/notes", async (request, reply) => {
    const id = positiveId(params(request).id);
    const divisionId = id ? await taskDivision(id) : null;
    if (id && !divisionId) return fail(reply, 404, "Pekerjaan tidak ditemukan.");
    const auth = await guardDivision(request, reply, READ_ROLES, divisionId, false);
    if (!auth) return reply;
    const result = await pool.query(
      `SELECT n.id, n.note, n.created_at, u.name AS author
         FROM task_notes n JOIN users u ON u.id = n.author_id WHERE n.task_id = $1 ORDER BY n.id DESC`,
      [id],
    );
    return ok(reply, result.rows);
  });

  app.post("/api/v1/timeline/tasks/:id/notes", async (request, reply) => {
    const id = positiveId(params(request).id);
    const divisionId = id ? await taskDivision(id) : null;
    if (id && !divisionId) return fail(reply, 404, "Pekerjaan tidak ditemukan.");
    const auth = await guardDivision(request, reply, WRITE_ROLES, divisionId, true);
    if (!auth || !id) return reply;
    const note = str(body(request).note, 2000);
    if (!note) return fail(reply, 422, "Catatan wajib diisi (maksimal 2000 karakter).");
    const result = await pool.query<{ id: number }>(
      "INSERT INTO task_notes (task_id, author_id, note) VALUES ($1, $2, $3) RETURNING id",
      [id, auth.user.id, note],
    );
    await pool.query("UPDATE tasks SET updated_at = NOW() WHERE id = $1", [id]);
    await audit(request, auth.user.id, "task_note_added", { entity: "tasks", entityId: id });
    return ok(reply.code(201), { id: result.rows[0]!.id });
  });

  // ---------- Laporan progres (beranda): semua peran pembaca, termasuk koordinator (D46) ----------
  app.get("/api/v1/timeline/report", async (request, reply) => {
    const auth = await requireAuth(request, reply, READ_ROLES);
    if (!auth) return reply;
    // Isi catatan progres: koordinator hanya melihat catatan divisinya sendiri.
    const seesAllNotes = auth.user.role !== "koordinator";
    const [divisions, totals, recent] = await Promise.all([
      pool.query(
        `SELECT d.id, d.name, ${MINE} AS mine,
                COUNT(t.id)::int AS total,
                COUNT(t.id) FILTER (WHERE t.status = 'selesai')::int AS selesai,
                COUNT(t.id) FILTER (WHERE t.status = 'berjalan')::int AS berjalan,
                COUNT(t.id) FILTER (WHERE t.status = 'tertunda')::int AS tertunda,
                COUNT(t.id) FILTER (WHERE t.status = 'belum')::int AS belum,
                COUNT(t.id) FILTER (WHERE t.status <> 'selesai' AND t.due_date < ${TODAY_WIB})::int AS terlambat,
                to_char(MIN(t.due_date) FILTER (WHERE t.status <> 'selesai'), 'YYYY-MM-DD') AS tenggat_terdekat
           FROM divisions d LEFT JOIN tasks t ON t.division_id = d.id GROUP BY d.id ORDER BY d.name`,
        [auth.user.role === "superadmin", auth.user.id],
      ),
      pool.query<{ total: number; selesai: number; terlambat: number }>(
        `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'selesai')::int AS selesai,
                COUNT(*) FILTER (WHERE status <> 'selesai' AND due_date < ${TODAY_WIB})::int AS terlambat FROM tasks`,
      ),
      pool.query(
        `SELECT n.id, n.note, n.created_at, u.name AS author, t.title AS task_title, d.name AS division
           FROM task_notes n JOIN tasks t ON t.id = n.task_id JOIN divisions d ON d.id = t.division_id
           JOIN users u ON u.id = n.author_id
          WHERE ($1::boolean OR t.division_id IN (SELECT division_id FROM user_divisions WHERE user_id = $2))
          ORDER BY n.id DESC LIMIT 10`,
        [seesAllNotes, auth.user.id],
      ),
    ]);
    return ok(reply, {
      totals: totals.rows[0],
      divisions: divisions.rows,
      recent_notes: recent.rows,
    });
  });

  // ---------- Pengelolaan divisi (superadmin) ----------
  app.get("/api/v1/admin/divisions", async (request, reply) => {
    if (!(await requireAuth(request, reply, ["superadmin"]))) return reply;
    const result = await pool.query(
      `SELECT d.id, d.name,
              COALESCE(json_agg(json_build_object('id', u.id, 'name', u.name, 'email', u.email) ORDER BY u.name)
                       FILTER (WHERE u.id IS NOT NULL), '[]') AS members
         FROM divisions d LEFT JOIN user_divisions ud ON ud.division_id = d.id LEFT JOIN users u ON u.id = ud.user_id
        GROUP BY d.id ORDER BY d.name`,
    );
    return ok(reply, result.rows);
  });

  app.post("/api/v1/admin/divisions", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    const name = str(body(request).name, 120);
    if (!name) return fail(reply, 422, "Nama divisi wajib diisi (maksimal 120 karakter).");
    try {
      const result = await pool.query<{ id: number }>(
        "INSERT INTO divisions (name) VALUES ($1) RETURNING id",
        [name],
      );
      await audit(request, auth.user.id, "division_created", {
        entity: "divisions",
        entityId: result.rows[0]!.id,
      });
      return ok(reply.code(201), { id: result.rows[0]!.id });
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        return fail(reply, 409, "Nama divisi sudah ada.");
      throw error;
    }
  });

  app.post("/api/v1/admin/divisions/:id/members", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    const divisionId = positiveId(params(request).id);
    const userId = positiveId(body(request).user_id);
    if (!divisionId || !userId) return fail(reply, 422, "Divisi atau pengguna tidak valid.");
    const user = await pool.query<{ role: Role }>("SELECT role FROM users WHERE id = $1", [userId]);
    if (!user.rows[0]) return fail(reply, 404, "Pengguna tidak ditemukan.");
    if (user.rows[0].role !== "koordinator")
      return fail(
        reply,
        409,
        "Hanya pengguna berperan koordinator yang dapat ditugaskan ke divisi.",
      );
    const exists = await pool.query("SELECT 1 FROM divisions WHERE id = $1", [divisionId]);
    if (exists.rowCount !== 1) return fail(reply, 404, "Divisi tidak ditemukan.");
    await pool.query(
      "INSERT INTO user_divisions (user_id, division_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, divisionId],
    );
    await audit(request, auth.user.id, "division_member_added", {
      entity: "divisions",
      entityId: divisionId,
      detail: { user_id: userId },
    });
    return ok(reply, { division_id: divisionId, user_id: userId });
  });

  app.post("/api/v1/admin/divisions/:id/members/:userId/remove", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    const divisionId = positiveId(params(request).id);
    const userId = positiveId(params(request).userId);
    if (!divisionId || !userId) return fail(reply, 422, "Divisi atau pengguna tidak valid.");
    await pool.query("DELETE FROM user_divisions WHERE user_id = $1 AND division_id = $2", [
      userId,
      divisionId,
    ]);
    await audit(request, auth.user.id, "division_member_removed", {
      entity: "divisions",
      entityId: divisionId,
      detail: { user_id: userId },
    });
    return ok(reply, { division_id: divisionId, user_id: userId });
  });
}
