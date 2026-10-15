import type { FastifyInstance } from "fastify";

import { audit } from "../audit.js";
import { requireAuth } from "../auth/guard.js";
import { pool } from "../db.js";
import { fail, ok } from "../http.js";
import { formatCsv } from "../lib/csv.js";
import {
  body,
  currentCeremonyId,
  pageMeta,
  pagination,
  positiveId,
  query,
  str,
} from "../lib/params.js";

export const ANONYMIZE_CONFIRMATION = "ANONIMKAN WISUDA 70";

async function sessionOr404(id: number | null) {
  if (!id) return null;
  const result = await pool.query<{ id: number; name: string; event_date: string }>(
    "SELECT id, name, to_char(event_date, 'YYYY-MM-DD') AS event_date FROM attendance_sessions WHERE id = $1",
    [id],
  );
  return result.rows[0] ?? null;
}

export async function registerReportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/admin/dashboard/stats", async (request, reply) => {
    if (!(await requireAuth(request, reply, ["superadmin"]))) return reply;
    const session = await sessionOr404(positiveId(query(request).session_id));
    if (!session) return fail(reply, 404, "Sesi tidak ditemukan.");
    const ceremonyId = await currentCeremonyId();
    const [totals, programs, trend, unregistered] = await Promise.all([
      pool.query<{ total: number; present: number; manual: number; outside: number }>(
        `SELECT COUNT(*)::int AS total, COUNT(a.id)::int AS present,
                COUNT(a.id) FILTER (WHERE a.method = 'manual')::int AS manual,
                COUNT(a.id) FILTER (WHERE a.outside_window)::int AS outside
           FROM students s LEFT JOIN attendances a ON a.student_id = s.id AND a.session_id = $1
          WHERE s.ceremony_id = $2 AND s.is_active AND s.anonymized_at IS NULL`,
        [session.id, ceremonyId],
      ),
      pool.query<{ study_program: string; total: number; present: number }>(
        `SELECT s.study_program, COUNT(*)::int AS total, COUNT(a.id)::int AS present
           FROM students s LEFT JOIN attendances a ON a.student_id = s.id AND a.session_id = $1
          WHERE s.ceremony_id = $2 AND s.is_active AND s.anonymized_at IS NULL
          GROUP BY s.study_program ORDER BY s.study_program`,
        [session.id, ceremonyId],
      ),
      pool.query<{ at: Date; count: number }>(
        `SELECT date_trunc('hour', scanned_at) + floor(extract(minute FROM scanned_at) / 10) * interval '10 minutes' AS at,
                COUNT(*)::int AS count
           FROM attendances WHERE session_id = $1 GROUP BY 1 ORDER BY 1 DESC LIMIT 12`,
        [session.id],
      ),
      pool.query<{ pending: number }>(
        "SELECT COUNT(*)::int AS pending FROM unregistered_entries WHERE session_id = $1 AND reviewed_at IS NULL",
        [session.id],
      ),
    ]);
    const t = totals.rows[0]!;
    return ok(reply, {
      session,
      total_students: t.total,
      present_count: t.present,
      absent_count: Math.max(0, t.total - t.present),
      manual_count: t.manual,
      outside_window_count: t.outside,
      unregistered_pending: unregistered.rows[0]?.pending ?? 0,
      by_study_program: programs.rows,
      scans_per_10min: trend.rows.reverse(),
    });
  });

  app.get("/api/v1/admin/attendances", async (request, reply) => {
    if (!(await requireAuth(request, reply, ["superadmin"]))) return reply;
    const q = query(request);
    const session = await sessionOr404(positiveId(q.session_id));
    if (!session) return fail(reply, 404, "Sesi tidak ditemukan.");
    const page = pagination(q);
    const [count, rows] = await Promise.all([
      pool.query<{ total: number }>(
        "SELECT COUNT(*)::int AS total FROM attendances WHERE session_id = $1",
        [session.id],
      ),
      pool.query(
        `SELECT a.id, s.nim, s.name, s.study_program, a.scanned_at, a.method, a.outside_window,
                a.device_label, u.name AS recorded_by
           FROM attendances a JOIN students s ON s.id = a.student_id JOIN users u ON u.id = a.user_id
          WHERE a.session_id = $1 ORDER BY a.scanned_at DESC, a.id DESC LIMIT $2 OFFSET $3`,
        [session.id, page.perPage, page.offset],
      ),
    ]);
    return ok(reply, rows.rows, pageMeta(page, count.rows[0]?.total ?? 0));
  });

  app.get("/api/v1/admin/attendances/export", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"]);
    if (!auth) return reply;
    const session = await sessionOr404(positiveId(query(request).session_id));
    if (!session) return fail(reply, 404, "Sesi tidak ditemukan.");
    const result = await pool.query<{
      nim: string;
      name: string;
      study_program: string;
      cohort_year: number | null;
      scanned_at: Date | null;
      method: string | null;
      outside_window: boolean | null;
      recorded_by: string | null;
      device_label: string | null;
    }>(
      `SELECT s.nim, s.name, s.study_program, s.cohort_year, a.scanned_at, a.method, a.outside_window,
              u.name AS recorded_by, a.device_label
         FROM students s
         LEFT JOIN attendances a ON a.student_id = s.id AND a.session_id = $1
         LEFT JOIN users u ON u.id = a.user_id
        WHERE s.ceremony_id = $2 AND s.is_active AND s.anonymized_at IS NULL
        ORDER BY s.study_program, s.name, s.nim`,
      [session.id, await currentCeremonyId()],
    );
    const rows: unknown[][] = [
      [
        "Tanggal",
        "NIM",
        "Nama",
        "Program Studi",
        "Angkatan",
        "Status",
        "Waktu Hadir (ISO)",
        "Metode",
        "Di Luar Jam",
        "Dicatat Oleh",
        "Titik Scanner",
      ],
    ];
    for (const r of result.rows) {
      rows.push([
        session.event_date,
        r.nim,
        r.name,
        r.study_program,
        r.cohort_year ?? "",
        r.scanned_at ? "Hadir" : "Belum hadir",
        r.scanned_at?.toISOString() ?? "",
        r.method ?? "",
        r.outside_window ? "ya" : "",
        r.recorded_by ?? "",
        r.device_label ?? "",
      ]);
    }
    await audit(request, auth.user.id, "attendance_exported", {
      entity: "attendance_sessions",
      entityId: session.id,
      detail: { rows: result.rows.length },
    });
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header(
        "Content-Disposition",
        `attachment; filename="rekap-kehadiran-${session.event_date}.csv"`,
      )
      .header("Cache-Control", "private, no-store")
      .send(formatCsv(rows));
  });

  // Retensi (ADR-0007): menghapus data pribadi permanen. Dijalankan hanya setelah BAAK menetapkan retensi.
  app.post("/api/v1/admin/retention/anonymize", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    if (str(body(request).confirm, 60) !== ANONYMIZE_CONFIRMATION) {
      return fail(
        reply,
        422,
        `Ketik persis "${ANONYMIZE_CONFIRMATION}" untuk mengonfirmasi. Tindakan ini tidak dapat dibatalkan.`,
      );
    }
    const ceremonyId = await currentCeremonyId();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const students = await client.query(
        `UPDATE students SET name = '[dianonimkan]', nim = 'ANON-' || id, cohort_year = NULL,
                graduation_date_text = NULL, is_active = FALSE, anonymized_at = NOW(),
                attendance_token = replace(gen_random_uuid()::text, '-', ''), updated_at = NOW()
          WHERE ceremony_id = $1 AND anonymized_at IS NULL`,
        [ceremonyId],
      );
      const entries = await client.query(
        `UPDATE unregistered_entries SET typed_nim = '[dianonimkan]', typed_name = NULL
          WHERE session_id IN (SELECT id FROM attendance_sessions WHERE ceremony_id = $1)`,
        [ceremonyId],
      );
      await client.query("COMMIT");
      await audit(request, auth.user.id, "retention_anonymized", {
        entity: "ceremonies",
        entityId: ceremonyId,
        detail: { students: students.rowCount, unregistered: entries.rowCount },
      });
      return ok(reply, { students: students.rowCount, unregistered_entries: entries.rowCount });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}
