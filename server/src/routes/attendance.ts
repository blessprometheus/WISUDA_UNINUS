import { createHmac } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { audit } from "../audit.js";
import { requireAuth } from "../auth/guard.js";
import { config } from "../config.js";
import { pool } from "../db.js";
import { fail, ok } from "../http.js";
import { body, currentCeremonyId, params, positiveId, query, str } from "../lib/params.js";
import { NIM_PATTERN } from "../lib/students-import.js";

const SCAN_ROLES = ["superadmin", "petugas"] as const;
const TOKEN_PATTERN = /^[0-9a-f]{32}$/i;

interface SessionRow {
  id: number;
  kind: "gladi" | "hari_h";
  name: string;
  event_date: string;
  starts_at: Date;
  ends_at: Date;
  is_active: boolean;
  window_open: boolean;
  attendance_count: number;
}

const SESSION_SELECT = `
  SELECT s.id, s.kind, s.name, to_char(s.event_date, 'YYYY-MM-DD') AS event_date,
         s.starts_at, s.ends_at, s.is_active,
         (NOW() BETWEEN s.starts_at AND s.ends_at) AS window_open,
         (SELECT COUNT(*)::int FROM attendances a WHERE a.session_id = s.id) AS attendance_count
    FROM attendance_sessions s`;

async function findSession(id: number): Promise<SessionRow | null> {
  const result = await pool.query<SessionRow>(`${SESSION_SELECT} WHERE s.id = $1`, [id]);
  return result.rows[0] ?? null;
}

async function listSessions(): Promise<SessionRow[]> {
  const result = await pool.query<SessionRow>(
    `${SESSION_SELECT} WHERE s.ceremony_id = $1 ORDER BY s.event_date, s.id`,
    [await currentCeremonyId()],
  );
  return result.rows;
}

function wibDate(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

interface SessionInput {
  kind: "gladi" | "hari_h";
  name: string;
  eventDate: string;
  startsAt: Date;
  endsAt: Date;
}

/** `starts_at` / `ends_at` berupa ISO-8601 dengan offset (mis. 2026-12-02T07:00:00+07:00). */
function readSessionInput(b: Record<string, unknown>): SessionInput | string {
  const kind = b.kind === "gladi" || b.kind === "hari_h" ? b.kind : null;
  const name = str(b.name, 120);
  const eventDate = str(b.event_date, 10);
  const startsAt = new Date(str(b.starts_at, 40));
  const endsAt = new Date(str(b.ends_at, 40));
  if (!kind) return "Jenis sesi harus gladi atau hari_h.";
  if (!name) return "Nama sesi wajib diisi.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || Number.isNaN(Date.parse(eventDate)))
    return "Tanggal acara tidak valid.";
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()))
    return "Jam mulai/akhir tidak valid (gunakan ISO-8601 dengan zona waktu).";
  if (endsAt <= startsAt) return "Jam akhir harus setelah jam mulai.";
  if (wibDate(startsAt) !== eventDate || wibDate(endsAt) !== eventDate) {
    return "Jam mulai dan akhir harus berada pada tanggal acara (WIB).";
  }
  return { kind, name, eventDate, startsAt, endsAt };
}

function scanLogHash(raw: string): string {
  return createHmac("sha256", config.auditSecret).update(`scan:${raw}`).digest("hex");
}

async function writeScanLog(
  userId: number,
  sessionId: number,
  studentId: number | null,
  result: string,
  raw: string,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO scan_logs (user_id, session_id, student_id, result, raw_input_hash)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, sessionId, studentId, result, scanLogHash(raw)],
    );
  } catch (error) {
    // Kehadiran sudah tercatat; kegagalan log tidak boleh membuat scan tampak gagal dan diulang.
    console.error("Gagal menulis scan_logs:", (error as Error).message);
  }
}

type ScanResult =
  "recorded" | "duplicate" | "unknown" | "not_active" | "outside_window" | "inactive_student";

const MESSAGES: Record<ScanResult, string> = {
  recorded: "Kehadiran berhasil dicatat.",
  duplicate: "Sudah tercatat hadir pada sesi ini.",
  unknown: "Tidak ditemukan dalam daftar wisudawan.",
  not_active: "Sesi ini belum diaktifkan oleh superadmin.",
  outside_window: "Di luar jam pemindaian sesi. Gunakan input NIM manual bila perlu.",
  inactive_student: "Wisudawan ini dinonaktifkan. Hubungi superadmin.",
};

interface StudentLite {
  id: number;
  nim: string;
  name: string;
  study_program: string;
  is_active: boolean;
}

async function handleScan(
  request: FastifyRequest,
  reply: FastifyReply,
  method: "qr" | "manual",
): Promise<FastifyReply> {
  const auth = await requireAuth(request, reply, SCAN_ROLES, { mutation: true });
  if (!auth) return reply;
  const b = body(request);
  const sessionId = positiveId(b.session_id);
  const raw = str(method === "qr" ? b.token : b.nim, 64);
  const deviceLabel = str(b.device_label, 60);
  const valid = method === "qr" ? TOKEN_PATTERN.test(raw) : NIM_PATTERN.test(raw);
  if (!sessionId || !valid || (typeof b.device_label === "string" && b.device_label.length > 60)) {
    return fail(reply, 422, "Data pemindaian tidak valid.");
  }
  const input = method === "qr" ? raw.toLowerCase() : raw.toUpperCase();
  const session = await findSession(sessionId);
  if (!session) return fail(reply, 404, "Sesi tidak ditemukan.");

  const respond = (
    result: ScanResult,
    student: StudentLite | null,
    extra: Record<string, unknown> = {},
  ) =>
    ok(reply, {
      result,
      message: MESSAGES[result],
      student: student
        ? { nim: student.nim, name: student.name, study_program: student.study_program }
        : null,
      ...extra,
    });

  // Sesi harus diaktifkan eksplisit oleh superadmin ("membuka gerbang").
  if (!session.is_active) {
    await writeScanLog(auth.user.id, sessionId, null, "not_active", input);
    return respond("not_active", null);
  }
  // Jendela waktu hanya berlaku untuk scan QR. Input manual di luar jendela tetap diterima tetapi ditandai (D26).
  const outsideWindow = !session.window_open;
  if (method === "qr" && outsideWindow) {
    await writeScanLog(auth.user.id, sessionId, null, "outside_window", input);
    return respond("outside_window", null);
  }

  const found = await pool.query<StudentLite>(
    `SELECT id, nim, name, study_program, is_active FROM students
      WHERE ceremony_id = $1 AND anonymized_at IS NULL AND ${method === "qr" ? "attendance_token" : "nim"} = $2`,
    [await currentCeremonyId(), input],
  );
  const student = found.rows[0] ?? null;
  if (!student) {
    await writeScanLog(auth.user.id, sessionId, null, "unknown", input);
    return respond("unknown", null);
  }
  if (!student.is_active) {
    await writeScanLog(auth.user.id, sessionId, student.id, "inactive_student", input);
    return respond("inactive_student", student);
  }

  const inserted = await pool.query<{ scanned_at: Date }>(
    `INSERT INTO attendances (student_id, session_id, user_id, method, outside_window, device_label)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT ON CONSTRAINT attendances_one_per_student_session DO NOTHING
     RETURNING scanned_at`,
    [student.id, sessionId, auth.user.id, method, outsideWindow, deviceLabel || null],
  );
  if (inserted.rows[0]) {
    await writeScanLog(auth.user.id, sessionId, student.id, "recorded", input);
    return respond("recorded", student, {
      scanned_at: inserted.rows[0].scanned_at,
      outside_window: outsideWindow,
    });
  }
  const existing = await pool.query<{ scanned_at: Date }>(
    "SELECT scanned_at FROM attendances WHERE student_id = $1 AND session_id = $2",
    [student.id, sessionId],
  );
  await writeScanLog(auth.user.id, sessionId, student.id, "duplicate", input);
  return respond("duplicate", student, { scanned_at: existing.rows[0]?.scanned_at ?? null });
}

export async function registerAttendanceRoutes(app: FastifyInstance): Promise<void> {
  const scanLimit = { config: { rateLimit: { max: 600, timeWindow: "1 minute" } } };

  app.get("/api/v1/scan/context", async (request, reply) => {
    const auth = await requireAuth(request, reply, SCAN_ROLES);
    if (!auth) return reply;
    const sessions = (await listSessions()).filter((s) => s.is_active);
    return ok(reply, {
      operator: { name: auth.user.name, role: auth.user.role },
      active_session: sessions[0] ?? null,
      server_time: new Date().toISOString(),
    });
  });

  app.post("/api/v1/scan", scanLimit, (request, reply) => handleScan(request, reply, "qr"));
  app.post("/api/v1/scan/manual", scanLimit, (request, reply) =>
    handleScan(request, reply, "manual"),
  );

  app.get("/api/v1/scan/recent", async (request, reply) => {
    if (!(await requireAuth(request, reply, SCAN_ROLES))) return reply;
    const q = query(request);
    const sessionId = positiveId(q.session_id);
    if (!sessionId) return fail(reply, 422, "Sesi tidak valid.");
    const limit = Math.min(20, positiveId(q.limit) ?? 10);
    const result = await pool.query(
      `SELECT s.nim, s.name, s.study_program, a.scanned_at, a.method, a.outside_window
         FROM attendances a JOIN students s ON s.id = a.student_id
        WHERE a.session_id = $1 ORDER BY a.scanned_at DESC, a.id DESC LIMIT $2`,
      [sessionId, limit],
    );
    return ok(reply, result.rows);
  });

  // D17: entri "tidak terdaftar" — dicatat untuk ditinjau, TIDAK dihitung hadir.
  app.post("/api/v1/scan/unregistered", scanLimit, async (request, reply) => {
    const auth = await requireAuth(request, reply, SCAN_ROLES, { mutation: true });
    if (!auth) return reply;
    const b = body(request);
    const sessionId = positiveId(b.session_id);
    const nim = str(b.nim, 30).toUpperCase();
    const name = str(b.name, 160);
    if (!sessionId || !NIM_PATTERN.test(nim)) return fail(reply, 422, "Isi NIM yang valid.");
    const session = await findSession(sessionId);
    if (!session?.is_active) return fail(reply, 409, MESSAGES.not_active);
    const result = await pool.query<{ id: number }>(
      `INSERT INTO unregistered_entries (session_id, user_id, typed_nim, typed_name)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [sessionId, auth.user.id, nim, name || null],
    );
    return ok(reply.code(201), {
      id: result.rows[0]!.id,
      counted_as_present: false,
      message: "Dicatat sebagai tidak terdaftar. Tidak dihitung hadir; akan ditinjau superadmin.",
    });
  });

  // ---------- Superadmin: kelola sesi ----------
  app.get("/api/v1/admin/attendance-sessions", async (request, reply) => {
    if (!(await requireAuth(request, reply, ["superadmin"]))) return reply;
    return ok(reply, await listSessions());
  });

  app.post("/api/v1/admin/attendance-sessions", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    const input = readSessionInput(body(request));
    if (typeof input === "string") return fail(reply, 422, input);
    try {
      const result = await pool.query<{ id: number }>(
        `INSERT INTO attendance_sessions (ceremony_id, kind, name, event_date, starts_at, ends_at)
         VALUES ($1, $2, $3, $4::date, $5, $6) RETURNING id`,
        [
          await currentCeremonyId(),
          input.kind,
          input.name,
          input.eventDate,
          input.startsAt,
          input.endsAt,
        ],
      );
      const id = result.rows[0]!.id;
      await audit(request, auth.user.id, "session_created", {
        entity: "attendance_sessions",
        entityId: id,
      });
      return ok(reply.code(201), await findSession(id));
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        return fail(reply, 409, "Tanggal ini sudah memiliki sesi.");
      throw error;
    }
  });

  // Jam (jendela) selalu boleh diubah — tidak perlu deploy (temuan audit #12). Tanggal & jenis hanya bila belum ada kehadiran.
  app.put("/api/v1/admin/attendance-sessions/:id", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    const id = positiveId(params(request).id);
    const input = readSessionInput(body(request));
    if (!id) return fail(reply, 422, "Sesi tidak valid.");
    if (typeof input === "string") return fail(reply, 422, input);
    const current = await findSession(id);
    if (!current) return fail(reply, 404, "Sesi tidak ditemukan.");
    if (
      current.attendance_count > 0 &&
      (current.event_date !== input.eventDate || current.kind !== input.kind)
    ) {
      return fail(
        reply,
        409,
        "Tanggal dan jenis sesi tidak dapat diubah setelah ada kehadiran. Jam masih dapat diubah.",
      );
    }
    try {
      await pool.query(
        `UPDATE attendance_sessions SET kind = $2, name = $3, event_date = $4::date,
                starts_at = $5, ends_at = $6, updated_at = NOW() WHERE id = $1`,
        [id, input.kind, input.name, input.eventDate, input.startsAt, input.endsAt],
      );
      await audit(request, auth.user.id, "session_updated", {
        entity: "attendance_sessions",
        entityId: id,
      });
      return ok(reply, await findSession(id));
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        return fail(reply, 409, "Tanggal ini sudah memiliki sesi.");
      throw error;
    }
  });

  app.post("/api/v1/admin/attendance-sessions/:id/activate", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    const id = positiveId(params(request).id);
    if (!id) return fail(reply, 422, "Sesi tidak valid.");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(20261016)");
      const exists = await client.query("SELECT 1 FROM attendance_sessions WHERE id = $1", [id]);
      if (exists.rowCount !== 1) {
        await client.query("ROLLBACK");
        return fail(reply, 404, "Sesi tidak ditemukan.");
      }
      await client.query(
        "UPDATE attendance_sessions SET is_active = FALSE, updated_at = NOW() WHERE is_active AND id <> $1",
        [id],
      );
      await client.query(
        "UPDATE attendance_sessions SET is_active = TRUE, updated_at = NOW() WHERE id = $1",
        [id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await audit(request, auth.user.id, "session_activated", {
      entity: "attendance_sessions",
      entityId: id,
    });
    return ok(reply, await findSession(id));
  });

  app.post("/api/v1/admin/attendance-sessions/:id/deactivate", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    const id = positiveId(params(request).id);
    if (!id) return fail(reply, 422, "Sesi tidak valid.");
    const result = await pool.query(
      "UPDATE attendance_sessions SET is_active = FALSE, updated_at = NOW() WHERE id = $1",
      [id],
    );
    if (result.rowCount !== 1) return fail(reply, 404, "Sesi tidak ditemukan.");
    await audit(request, auth.user.id, "session_deactivated", {
      entity: "attendance_sessions",
      entityId: id,
    });
    return ok(reply, await findSession(id));
  });

  // ---------- Superadmin: entri tidak terdaftar ----------
  app.get("/api/v1/admin/unregistered", async (request, reply) => {
    if (!(await requireAuth(request, reply, ["superadmin"]))) return reply;
    const sessionId = positiveId(query(request).session_id);
    if (!sessionId) return fail(reply, 422, "Sesi tidak valid.");
    const result = await pool.query(
      `SELECT e.id, e.typed_nim, e.typed_name, e.created_at, e.reviewed_at, u.name AS entered_by
         FROM unregistered_entries e JOIN users u ON u.id = e.user_id
        WHERE e.session_id = $1 ORDER BY e.created_at DESC`,
      [sessionId],
    );
    return ok(reply, result.rows);
  });

  app.post("/api/v1/admin/unregistered/:id/review", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    const id = positiveId(params(request).id);
    if (!id) return fail(reply, 422, "Entri tidak valid.");
    const result = await pool.query(
      "UPDATE unregistered_entries SET reviewed_at = NOW(), reviewed_by = $2 WHERE id = $1 AND reviewed_at IS NULL",
      [id, auth.user.id],
    );
    if (result.rowCount !== 1)
      return fail(reply, 404, "Entri tidak ditemukan atau sudah ditinjau.");
    await audit(request, auth.user.id, "unregistered_reviewed", {
      entity: "unregistered_entries",
      entityId: id,
    });
    return ok(reply, { id });
  });
}
