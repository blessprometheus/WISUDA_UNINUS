import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { FastifyInstance } from "fastify";
import QRCode from "qrcode";

import { audit } from "../audit.js";
import { requireAuth } from "../auth/guard.js";
import { config } from "../config.js";
import { pool } from "../db.js";
import { fail, ok } from "../http.js";
import { CsvError, parseCsv } from "../lib/csv.js";
import {
  body,
  currentCeremonyId,
  pageMeta,
  pagination,
  params,
  positiveId,
  query,
  str,
} from "../lib/params.js";
import { NIM_PATTERN, analyzeImport } from "../lib/students-import.js";

const MAX_IMPORT_BYTES = 5_000_000;
const MAX_IMPORT_ROWS = 5_000;
const DOWNLOAD_SECONDS = 15 * 60;

function newToken(): string {
  return randomBytes(16).toString("hex");
}

function downloadSignature(studentId: string, expires: string): string {
  return createHmac("sha256", config.downloadSecret)
    .update(`GET\n/api/v1/download/qr/${studentId}\n${expires}`)
    .digest("hex");
}

function validSignature(studentId: string, q: Record<string, unknown>): boolean {
  const { expires, signature } = q;
  if (typeof expires !== "string" || !/^[0-9]{10}$/.test(expires)) return false;
  if (typeof signature !== "string" || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const now = Math.floor(Date.now() / 1000);
  const expiry = Number(expires);
  if (expiry < now || expiry > now + DOWNLOAD_SECONDS) return false;
  return timingSafeEqual(
    Buffer.from(downloadSignature(studentId, expires), "hex"),
    Buffer.from(signature, "hex"),
  );
}

function signedQrUrl(studentId: number): string {
  const expires = String(Math.floor(Date.now() / 1000) + DOWNLOAD_SECONDS);
  const url = new URL(`/api/v1/download/qr/${studentId}`, config.publicOrigin);
  url.searchParams.set("expires", expires);
  url.searchParams.set("signature", downloadSignature(String(studentId), expires));
  return url.pathname + url.search;
}

interface StudentInput {
  nim: string;
  name: string;
  studyProgram: string;
  cohortYear: number | null;
  graduationDateText: string | null;
}

function readStudentInput(b: Record<string, unknown>): StudentInput | string {
  const nim = str(b.nim, 30).toUpperCase();
  const name = str(b.name, 160);
  const studyProgram = str(b.study_program, 160);
  if (!NIM_PATTERN.test(nim)) return "NIM tidak valid.";
  if (!name) return "Nama wajib diisi (maksimal 160 karakter).";
  if (!studyProgram) return "Program studi wajib diisi (maksimal 160 karakter).";
  let cohortYear: number | null = null;
  if (b.cohort_year !== undefined && b.cohort_year !== null && b.cohort_year !== "") {
    const year = Number(b.cohort_year);
    if (!Number.isInteger(year) || year < 1990 || year > 2100) return "Angkatan tidak valid.";
    cohortYear = year;
  }
  const graduation = str(b.graduation_date_text, 40);
  return { nim, name, studyProgram, cohortYear, graduationDateText: graduation || null };
}

export async function registerStudentRoutes(app: FastifyInstance): Promise<void> {
  // Impor dikirim sebagai isi mentah text/csv (tanpa multipart): satu dependensi lebih sedikit.
  app.addContentTypeParser(
    "text/csv",
    { parseAs: "buffer", bodyLimit: MAX_IMPORT_BYTES },
    (_request, payload, done) => done(null, payload),
  );

  // ---------- Publik: cari NIM → unduh QR (ADR-0004) ----------
  app.post(
    "/api/v1/lookup",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const nim = str(body(request).nim, 30).toUpperCase();
      if (!NIM_PATTERN.test(nim)) return fail(reply, 422, "NIM tidak valid.");
      const result = await pool.query<{
        id: number;
        nim: string;
        name: string;
        study_program: string;
      }>(
        `SELECT id, nim, name, study_program FROM students
          WHERE ceremony_id = $1 AND nim = $2 AND is_active = TRUE AND anonymized_at IS NULL`,
        [await currentCeremonyId(), nim],
      );
      const student = result.rows[0];
      if (!student) return fail(reply, 404, "NIM tidak ditemukan dalam daftar wisudawan.");
      return ok(reply, {
        nim: student.nim,
        name: student.name,
        study_program: student.study_program,
        qr_url: signedQrUrl(student.id),
      });
    },
  );

  app.get(
    "/api/v1/download/qr/:id",
    { config: { rateLimit: { max: 240, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const id = String(params(request).id ?? "");
      if (!/^[1-9][0-9]{0,17}$/.test(id) || !validSignature(id, query(request))) {
        return fail(reply, 403, "Tautan unduhan tidak valid atau telah kedaluwarsa.");
      }
      const result = await pool.query<{ nim: string; attendance_token: string }>(
        `SELECT nim, attendance_token FROM students
          WHERE id = $1 AND is_active = TRUE AND anonymized_at IS NULL`,
        [id],
      );
      const student = result.rows[0];
      if (!student) return fail(reply, 404, "Wisudawan tidak ditemukan.");
      const png = await QRCode.toBuffer(student.attendance_token, {
        type: "png",
        errorCorrectionLevel: "M",
        margin: 4,
        width: 480,
      });
      const safeNim = student.nim.replace(/[^0-9A-Za-z.-]/g, "-");
      return reply
        .header("Cache-Control", "private, no-store, max-age=0")
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Disposition", `attachment; filename="QR-WISUDA-70-${safeNim}.png"`)
        .type("image/png")
        .send(png);
    },
  );

  // ---------- Superadmin: impor CSV ----------
  app.post(
    "/api/v1/admin/students/import",
    { bodyLimit: MAX_IMPORT_BYTES, config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
      if (!auth) return reply;
      if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
        return fail(reply, 422, "Kirim isi berkas CSV UTF-8 dengan Content-Type: text/csv.");
      }
      const dryRun = query(request).dry_run === "1";
      const filename = str(request.headers["x-filename"], 255).split(/[\\/]/).at(-1) || "impor.csv";

      let analysis;
      try {
        analysis = analyzeImport(parseCsv(request.body, MAX_IMPORT_ROWS));
      } catch (error) {
        if (error instanceof CsvError) return fail(reply, 422, error.message);
        throw error;
      }
      const ceremonyId = await currentCeremonyId();
      const nims = analysis.valid.map((entry) => entry.student.nim);
      const existing = await pool.query<{ nim: string }>(
        "SELECT nim FROM students WHERE ceremony_id = $1 AND nim = ANY($2::text[])",
        [ceremonyId, nims],
      );
      const existingSet = new Set(existing.rows.map((row) => row.nim));
      const wouldUpdate = nims.filter((nim) => existingSet.has(nim)).length;
      const summary = {
        total_rows: analysis.totalRows,
        valid_rows: analysis.valid.length,
        error_count: analysis.errors.length,
        errors: analysis.errors,
        warnings: analysis.warnings,
        ignored_columns: analysis.ignoredColumns,
      };
      if (dryRun) {
        return ok(reply, {
          dry_run: true,
          ...summary,
          would_insert: analysis.valid.length - wouldUpdate,
          would_update: wouldUpdate,
        });
      }
      if (analysis.valid.length === 0) {
        return fail(reply, 422, "Tidak ada baris valid untuk diimpor. Periksa pratinjau galat.");
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(20261015)");
        const batch = await client.query<{ id: number }>(
          `INSERT INTO import_batches (ceremony_id, user_id, original_filename, status)
           VALUES ($1, $2, $3, 'processing') RETURNING id`,
          [ceremonyId, auth.user.id, filename],
        );
        const batchId = batch.rows[0]!.id;
        let inserted = 0;
        let updated = 0;
        let skippedAnonymized = 0;
        for (const { student } of analysis.valid) {
          // attendance_token SENGAJA tidak ada di DO UPDATE: QR stabil saat impor ulang (D16).
          const result = await client.query<{ inserted: boolean }>(
            `INSERT INTO students
               (ceremony_id, nim, name, study_program, cohort_year, graduation_date_text,
                attendance_token, import_batch_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (ceremony_id, nim) DO UPDATE SET
               name = EXCLUDED.name, study_program = EXCLUDED.study_program,
               cohort_year = EXCLUDED.cohort_year,
               graduation_date_text = EXCLUDED.graduation_date_text,
               import_batch_id = EXCLUDED.import_batch_id, updated_at = NOW()
             WHERE students.anonymized_at IS NULL
             RETURNING (xmax = 0) AS inserted`,
            [
              ceremonyId,
              student.nim,
              student.name,
              student.studyProgram,
              student.cohortYear,
              student.graduationDateText,
              newToken(),
              batchId,
            ],
          );
          if (!result.rows[0]) skippedAnonymized += 1;
          else if (result.rows[0].inserted) inserted += 1;
          else updated += 1;
        }
        await client.query(
          `UPDATE import_batches SET status = 'done', total_rows = $2, inserted_count = $3,
             updated_count = $4, failed_count = $5, error_report = $6::jsonb WHERE id = $1`,
          [
            batchId,
            analysis.totalRows,
            inserted,
            updated,
            analysis.errors.length + skippedAnonymized,
            JSON.stringify(analysis.errors),
          ],
        );
        await client.query("COMMIT");
        await audit(request, auth.user.id, "students_import", {
          entity: "import_batches",
          entityId: batchId,
          detail: { filename, inserted, updated, errors: analysis.errors.length },
        });
        return ok(reply, {
          dry_run: false,
          batch_id: batchId,
          inserted,
          updated,
          skipped_anonymized: skippedAnonymized,
          ...summary,
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  );

  app.get("/api/v1/admin/import-batches", async (request, reply) => {
    if (!(await requireAuth(request, reply, ["superadmin"]))) return reply;
    const result = await pool.query(
      `SELECT b.id, b.original_filename, b.status, b.total_rows, b.inserted_count, b.updated_count,
              b.failed_count, b.created_at, u.name AS imported_by
         FROM import_batches b JOIN users u ON u.id = b.user_id ORDER BY b.id DESC LIMIT 50`,
    );
    return ok(reply, result.rows);
  });

  // ---------- Superadmin: kelola wisudawan satu per satu ----------
  app.get("/api/v1/admin/students", async (request, reply) => {
    if (!(await requireAuth(request, reply, ["superadmin"]))) return reply;
    const q = query(request);
    const page = pagination(q);
    const search = str(q.search, 100);
    const pattern = search ? `%${search.replace(/[\\%_]/g, "\\$&")}%` : null;
    const ceremonyId = await currentCeremonyId();
    const where = `WHERE ceremony_id = $1 AND ($2::text IS NULL OR nim ILIKE $2 OR name ILIKE $2 OR study_program ILIKE $2)`;
    const [count, rows] = await Promise.all([
      pool.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM students ${where}`, [
        ceremonyId,
        pattern,
      ]),
      pool.query(
        `SELECT id, nim, name, study_program, cohort_year, graduation_date_text, is_active, anonymized_at, updated_at
           FROM students ${where} ORDER BY study_program, name, nim LIMIT $3 OFFSET $4`,
        [ceremonyId, pattern, page.perPage, page.offset],
      ),
    ]);
    return ok(reply, rows.rows, pageMeta(page, count.rows[0]?.total ?? 0));
  });

  app.post("/api/v1/admin/students", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    const input = readStudentInput(body(request));
    if (typeof input === "string") return fail(reply, 422, input);
    try {
      const result = await pool.query<{ id: number }>(
        `INSERT INTO students (ceremony_id, nim, name, study_program, cohort_year, graduation_date_text, attendance_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          await currentCeremonyId(),
          input.nim,
          input.name,
          input.studyProgram,
          input.cohortYear,
          input.graduationDateText,
          newToken(),
        ],
      );
      await audit(request, auth.user.id, "student_created", {
        entity: "students",
        entityId: result.rows[0]!.id,
      });
      return ok(reply.code(201), { id: result.rows[0]!.id });
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        return fail(reply, 409, `NIM ${input.nim} sudah terdaftar.`);
      throw error;
    }
  });

  app.put("/api/v1/admin/students/:id", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    const id = positiveId(params(request).id);
    const input = readStudentInput(body(request));
    if (!id) return fail(reply, 422, "Wisudawan tidak valid.");
    if (typeof input === "string") return fail(reply, 422, input);
    try {
      const result = await pool.query(
        `UPDATE students SET nim = $2, name = $3, study_program = $4, cohort_year = $5,
                graduation_date_text = $6, updated_at = NOW()
          WHERE id = $1 AND anonymized_at IS NULL`,
        [id, input.nim, input.name, input.studyProgram, input.cohortYear, input.graduationDateText],
      );
      if (result.rowCount !== 1) return fail(reply, 404, "Wisudawan tidak ditemukan.");
      await audit(request, auth.user.id, "student_updated", { entity: "students", entityId: id });
      return ok(reply, { id });
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        return fail(reply, 409, `NIM ${input.nim} sudah terdaftar.`);
      throw error;
    }
  });

  for (const [action, active] of [
    ["deactivate", false],
    ["reactivate", true],
  ] as const) {
    app.post(`/api/v1/admin/students/:id/${action}`, async (request, reply) => {
      const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
      if (!auth) return reply;
      const id = positiveId(params(request).id);
      if (!id) return fail(reply, 422, "Wisudawan tidak valid.");
      const result = await pool.query(
        "UPDATE students SET is_active = $2, updated_at = NOW() WHERE id = $1 AND anonymized_at IS NULL",
        [id, active],
      );
      if (result.rowCount !== 1) return fail(reply, 404, "Wisudawan tidak ditemukan.");
      await audit(request, auth.user.id, `student_${action}d`, {
        entity: "students",
        entityId: id,
      });
      return ok(reply, { id, is_active: active });
    });
  }
}
