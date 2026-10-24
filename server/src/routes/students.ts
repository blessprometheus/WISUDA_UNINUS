import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { FastifyInstance } from "fastify";
import QRCode from "qrcode";

import { audit } from "../audit.js";
import { requireAuth } from "../auth/guard.js";
import { config } from "../config.js";
import { pool } from "../db.js";
import { fail, ok } from "../http.js";
import { CsvError, parseCsv } from "../lib/csv.js";
import { detectEvidenceType } from "../lib/evidence.js";
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
import { NIM_PATTERN, analyzeFinanceSync, analyzeImport } from "../lib/students-import.js";

const MAX_IMPORT_BYTES = 5_000_000;
const MAX_IMPORT_ROWS = 5_000;
const MAX_PHOTO_BYTES = 500 * 1024;
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
  isPaid: boolean;
  isYudisium: boolean;
  eligibilityNote: string | null;
  gender: string | null;
  togaSize: string | null;
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
  const isPaid = b.is_paid === true || b.is_paid === 1 || b.is_paid === "1";
  const isYudisium = b.is_yudisium === true || b.is_yudisium === 1 || b.is_yudisium === "1";
  const eligibilityNote = str(b.eligibility_note, 500) || null;
  const rawGender = str(b.gender, 20);
  const gender = rawGender === "Laki-laki" || rawGender === "Perempuan" ? rawGender : null;
  const rawToga = str(b.toga_size, 10).toUpperCase();
  const togaSize = ["M", "L", "XL", "XXL", "XXXL", "XXXXL"].includes(rawToga) ? rawToga : null;
  return {
    nim,
    name,
    studyProgram,
    cohortYear,
    graduationDateText: graduation || null,
    isPaid,
    isYudisium,
    eligibilityNote,
    gender,
    togaSize,
  };
}

const TOGA_SIZES = new Set(["M", "L", "XL", "XXL", "XXXL", "XXXXL"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseBase64Photo(raw: unknown): { mime: string; bytes: Buffer } | string {
  if (typeof raw !== "string" || raw.length === 0) return "Foto formal wajib diunggah.";
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(raw);
  const b64 = match ? match[2]! : raw;
  let buf: Buffer;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    return "Format berkas foto tidak valid.";
  }
  if (buf.length === 0) return "Berkas foto kosong.";
  if (buf.length > MAX_PHOTO_BYTES) return "Ukuran foto melebihi batas maksimal 500 KB.";
  const detected = detectEvidenceType(buf);
  if (!detected || detected.mime === "application/pdf") {
    return "Foto wajib berformat JPG, PNG, atau WebP.";
  }
  return { mime: detected.mime, bytes: buf };
}

export async function registerStudentRoutes(app: FastifyInstance): Promise<void> {
  // Impor dikirim sebagai isi mentah text/csv (tanpa multipart): satu dependensi lebih sedikit.
  app.addContentTypeParser(
    "text/csv",
    { parseAs: "buffer", bodyLimit: MAX_IMPORT_BYTES },
    (_request, payload, done) => done(null, payload),
  );

  // ---------- Publik: verifikasi kelayakan pendaftaran & submit formulir wisuda ----------
  app.post(
    "/api/v1/registration/verify",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const nim = str(body(request).nim, 30).toUpperCase();
      if (!NIM_PATTERN.test(nim)) return fail(reply, 422, "NIM tidak valid.");
      const result = await pool.query<{
        id: number;
        nim: string;
        name: string;
        study_program: string;
        cohort_year: number | null;
        graduation_date_text: string | null;
        is_paid: boolean;
        is_yudisium: boolean;
        eligibility_note: string | null;
        registration_status: string;
        registered_at: Date | null;
        gender: string | null;
        toga_size: string | null;
        birth_place: string | null;
        birth_date: string | null;
        phone: string | null;
        email: string | null;
        gpa: string | null;
        graduation_date: string | null;
        thesis_title: string | null;
      }>(
        `SELECT id, nim, name, study_program, cohort_year, graduation_date_text,
                is_paid, is_yudisium, eligibility_note, registration_status, registered_at,
                gender, toga_size, birth_place, to_char(birth_date, 'YYYY-MM-DD') AS birth_date,
                phone, email, gpa::text AS gpa, to_char(graduation_date, 'YYYY-MM-DD') AS graduation_date,
                thesis_title
           FROM students
          WHERE ceremony_id = $1 AND nim = $2 AND is_active = TRUE AND anonymized_at IS NULL`,
        [await currentCeremonyId(), nim],
      );
      const student = result.rows[0];
      if (!student) {
        return ok(reply, {
          status: "not_found",
          message:
            "NIM tidak ditemukan dalam database peserta wisuda. Silakan hubungi BAAK/panitia.",
        });
      }
      const reasons: string[] = [];
      if (!student.is_paid) {
        reasons.push("Belum menyelesaikan pembayaran biaya wisuda (Keuangan).");
      }
      if (!student.is_yudisium) {
        reasons.push("Belum dinyatakan lulus Yudisium (Akademik/Fakultas).");
      }
      if (student.eligibility_note && reasons.length > 0) {
        reasons.push(`Catatan administrasi: ${student.eligibility_note}`);
      }
      if (reasons.length > 0) {
        return ok(reply, {
          status: "failed_verification",
          message: "Mohon maaf, Anda belum dapat melanjutkan pendaftaran wisuda.",
          reasons,
          data: {
            nim: student.nim,
            name: student.name,
            study_program: student.study_program,
            is_paid: student.is_paid,
            is_yudisium: student.is_yudisium,
          },
        });
      }
      return ok(reply, {
        status: "success",
        message:
          student.registration_status === "terdaftar"
            ? "Anda sudah terdaftar. Anda dapat memperbarui data pendaftaran atau langsung mengunduh bukti pendaftaran & Kartu QR."
            : "Data Anda terverifikasi (Pembayaran Lunas & Telah Yudisium). Silakan lengkapi formulir pendaftaran di bawah ini.",
        data: {
          nim: student.nim,
          name: student.name,
          study_program: student.study_program,
          cohort_year: student.cohort_year,
          graduation_date_text: student.graduation_date_text,
          is_paid: student.is_paid,
          is_yudisium: student.is_yudisium,
          registration_status: student.registration_status,
          registered_at: student.registered_at?.toISOString() ?? null,
          qr_url: signedQrUrl(student.id),
          existing_form:
            student.registration_status === "terdaftar"
              ? {
                  gender: student.gender,
                  toga_size: student.toga_size,
                  birth_place: student.birth_place,
                  birth_date: student.birth_date,
                  phone: student.phone,
                  email: student.email,
                  gpa: student.gpa,
                  graduation_date: student.graduation_date,
                  thesis_title: student.thesis_title,
                }
              : null,
        },
      });
    },
  );

  app.post(
    "/api/v1/registration/submit",
    { bodyLimit: 1_500_000, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const b = body(request);
      const nim = str(b.nim, 30).toUpperCase();
      if (!NIM_PATTERN.test(nim)) return fail(reply, 422, "NIM tidak valid.");

      const gender = str(b.gender, 16);
      if (gender !== "Laki-laki" && gender !== "Perempuan") {
        return fail(reply, 422, "Pilih jenis kelamin (Laki-laki atau Perempuan).");
      }
      const togaSize = str(b.toga_size, 8).toUpperCase();
      if (!TOGA_SIZES.has(togaSize)) {
        return fail(reply, 422, "Pilih ukuran baju toga yang valid (M s.d. XXXXL).");
      }
      const birthPlace = str(b.birth_place, 120);
      if (!birthPlace) return fail(reply, 422, "Tempat lahir wajib diisi.");
      const birthDate = str(b.birth_date, 10);
      if (!DATE_PATTERN.test(birthDate) || Number.isNaN(Date.parse(birthDate))) {
        return fail(reply, 422, "Tanggal lahir tidak valid.");
      }
      const phone = str(b.phone, 30);
      if (!/^[0-9+ -]{8,25}$/.test(phone)) {
        return fail(reply, 422, "Nomor Handphone/WhatsApp tidak valid.");
      }
      const email = str(b.email, 160).toLowerCase();
      if (!EMAIL_PATTERN.test(email)) {
        return fail(reply, 422, "Alamat email tidak valid.");
      }
      const gpaNum = Number(b.gpa);
      if (!Number.isFinite(gpaNum) || gpaNum < 0 || gpaNum > 4) {
        return fail(reply, 422, "IPK harus berupa angka antara 0.00 hingga 4.00.");
      }
      const graduationDate = str(b.graduation_date, 10);
      if (!DATE_PATTERN.test(graduationDate) || Number.isNaN(Date.parse(graduationDate))) {
        return fail(reply, 422, "Tanggal lulus (Yudisium) tidak valid.");
      }
      const thesisTitle = str(b.thesis_title, 500);
      if (!thesisTitle) {
        return fail(reply, 422, "Judul Tugas Akhir/Skripsi/Tesis/Disertasi wajib diisi.");
      }

      const ceremonyId = await currentCeremonyId();
      const existing = await pool.query<{
        id: number;
        name: string;
        study_program: string;
        is_paid: boolean;
        is_yudisium: boolean;
        has_photo: boolean;
      }>(
        `SELECT id, name, study_program, is_paid, is_yudisium, (photo_data IS NOT NULL) AS has_photo
           FROM students
          WHERE ceremony_id = $1 AND nim = $2 AND is_active = TRUE AND anonymized_at IS NULL`,
        [ceremonyId, nim],
      );
      const student = existing.rows[0];
      if (!student) return fail(reply, 404, "NIM tidak ditemukan dalam daftar wisudawan.");
      if (!student.is_paid || !student.is_yudisium) {
        return fail(
          reply,
          403,
          "Anda belum memenuhi syarat kelayakan pendaftaran (pembayaran wisuda & kelulusan yudisium).",
        );
      }

      let photoMime: string | null = null;
      let photoBytes: Buffer | null = null;
      if (b.photo_base64) {
        const parsedPhoto = parseBase64Photo(b.photo_base64);
        if (typeof parsedPhoto === "string") return fail(reply, 422, parsedPhoto);
        photoMime = parsedPhoto.mime;
        photoBytes = parsedPhoto.bytes;
      } else if (!student.has_photo) {
        return fail(reply, 422, "Foto formal wajib diunggah (JPG/PNG, maks. 500 KB).");
      }

      if (photoBytes && photoMime) {
        await pool.query(
          `UPDATE students
              SET gender = $2, toga_size = $3, birth_place = $4, birth_date = $5::date,
                  phone = $6, email = $7, gpa = $8, graduation_date = $9::date,
                  thesis_title = $10, photo_mime = $11, photo_bytes = $12, photo_data = $13,
                  registration_status = 'terdaftar', registered_at = COALESCE(registered_at, NOW()),
                  updated_at = NOW()
            WHERE id = $1`,
          [
            student.id,
            gender,
            togaSize,
            birthPlace,
            birthDate,
            phone,
            email,
            gpaNum.toFixed(2),
            graduationDate,
            thesisTitle,
            photoMime,
            photoBytes.length,
            photoBytes,
          ],
        );
      } else {
        await pool.query(
          `UPDATE students
              SET gender = $2, toga_size = $3, birth_place = $4, birth_date = $5::date,
                  phone = $6, email = $7, gpa = $8, graduation_date = $9::date,
                  thesis_title = $10,
                  registration_status = 'terdaftar', registered_at = COALESCE(registered_at, NOW()),
                  updated_at = NOW()
            WHERE id = $1`,
          [
            student.id,
            gender,
            togaSize,
            birthPlace,
            birthDate,
            phone,
            email,
            gpaNum.toFixed(2),
            graduationDate,
            thesisTitle,
          ],
        );
      }

      await audit(request, null, "student_self_registered", {
        entity: "students",
        entityId: student.id,
        detail: { nim, toga_size: togaSize },
      });

      return ok(reply, {
        status: "success",
        message: "Pendaftaran wisuda berhasil disimpan.",
        data: {
          nim,
          name: student.name,
          study_program: student.study_program,
          qr_url: signedQrUrl(student.id),
          registered_at: new Date().toISOString(),
        },
      });
    },
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
                is_paid, is_yudisium, eligibility_note, attendance_token, import_batch_id)
             VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, FALSE), COALESCE($8, FALSE), $9, $10, $11)
             ON CONFLICT (ceremony_id, nim) DO UPDATE SET
               name = EXCLUDED.name, study_program = EXCLUDED.study_program,
               cohort_year = EXCLUDED.cohort_year,
               graduation_date_text = EXCLUDED.graduation_date_text,
               is_paid = COALESCE($7, students.is_paid),
               is_yudisium = COALESCE($8, students.is_yudisium),
               eligibility_note = COALESCE($9, students.eligibility_note),
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
              student.isPaid,
              student.isYudisium,
              student.eligibilityNote,
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

  // ---------- Superadmin: sinkronisasi spreadsheet keuangan & yudisium ----------
  app.post(
    "/api/v1/admin/students/sync-finance",
    { bodyLimit: MAX_IMPORT_BYTES, config: { rateLimit: { max: 20, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
      if (!auth) return reply;
      if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
        return fail(reply, 422, "Kirim isi berkas CSV UTF-8 dengan Content-Type: text/csv.");
      }
      const dryRun = query(request).dry_run === "1";
      const filename =
        str(request.headers["x-filename"], 255).split(/[\\/]/).at(-1) || "sinkron-keuangan.csv";

      let analysis;
      try {
        analysis = analyzeFinanceSync(parseCsv(request.body, MAX_IMPORT_ROWS));
      } catch (error) {
        if (error instanceof CsvError) return fail(reply, 422, error.message);
        throw error;
      }
      const ceremonyId = await currentCeremonyId();
      const nims = analysis.valid.map((entry) => entry.item.nim);
      const existing = await pool.query<{ nim: string }>(
        "SELECT nim FROM students WHERE ceremony_id = $1 AND nim = ANY($2::text[]) AND anonymized_at IS NULL",
        [ceremonyId, nims],
      );
      const existingSet = new Set(existing.rows.map((row) => row.nim));
      const matched = nims.filter((nim) => existingSet.has(nim)).length;
      const unmatchedNims = nims.filter((nim) => !existingSet.has(nim));

      const summary = {
        total_rows: analysis.totalRows,
        valid_rows: analysis.valid.length,
        error_count: analysis.errors.length,
        errors: analysis.errors,
        warnings: [
          ...analysis.warnings,
          ...unmatchedNims.slice(0, 50).map((nim) => ({
            row: 0,
            column: "nim",
            message: `NIM ${nim} belum ada di database wisudawan (dilewati).`,
          })),
        ],
        ignored_columns: analysis.ignoredColumns,
        unmatched_count: unmatchedNims.length,
      };

      if (dryRun) {
        return ok(reply, {
          dry_run: true,
          ...summary,
          would_update: matched,
        });
      }
      if (matched === 0) {
        return fail(
          reply,
          422,
          "Tidak ada NIM yang cocok dengan database wisudawan. Impor data dasar wisudawan terlebih dahulu.",
        );
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        let updated = 0;
        for (const { item } of analysis.valid) {
          if (!existingSet.has(item.nim)) continue;
          const res = await client.query(
            `UPDATE students
                SET is_paid = COALESCE($3, is_paid),
                    is_yudisium = COALESCE($4, is_yudisium),
                    eligibility_note = CASE WHEN $5::text IS NOT NULL THEN NULLIF($5, '') ELSE eligibility_note END,
                    updated_at = NOW()
              WHERE ceremony_id = $1 AND nim = $2 AND anonymized_at IS NULL`,
            [ceremonyId, item.nim, item.isPaid, item.isYudisium, item.eligibilityNote],
          );
          if (res.rowCount && res.rowCount > 0) updated += 1;
        }
        await client.query("COMMIT");
        await audit(request, auth.user.id, "students_finance_synced", {
          entity: "students",
          detail: { filename, updated, unmatched: unmatchedNims.length },
        });
        return ok(reply, {
          dry_run: false,
          updated,
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

  app.get("/api/v1/admin/students/summary", async (request, reply) => {
    if (!(await requireAuth(request, reply, ["superadmin"]))) return reply;
    const ceremonyId = await currentCeremonyId();
    const [totalsRes, togaRes, angkatanRes, prodiRes, recentRes] = await Promise.all([
      pool.query<{
        total: number;
        paid: number;
        yudisium: number;
        eligible: number;
        registered: number;
        blocked: number;
        unregistered_eligible: number;
        avg_gpa: string | null;
        laki_laki: number;
        perempuan: number;
      }>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE is_paid)::int AS paid,
                COUNT(*) FILTER (WHERE is_yudisium)::int AS yudisium,
                COUNT(*) FILTER (WHERE is_paid AND is_yudisium)::int AS eligible,
                COUNT(*) FILTER (WHERE registration_status = 'terdaftar')::int AS registered,
                COUNT(*) FILTER (WHERE NOT (is_paid AND is_yudisium))::int AS blocked,
                COUNT(*) FILTER (WHERE is_paid AND is_yudisium AND registration_status = 'belum_daftar')::int AS unregistered_eligible,
                ROUND(AVG(gpa), 2)::text AS avg_gpa,
                COUNT(*) FILTER (WHERE gender = 'Laki-laki')::int AS laki_laki,
                COUNT(*) FILTER (WHERE gender = 'Perempuan')::int AS perempuan
           FROM students
          WHERE ceremony_id = $1 AND is_active = TRUE AND anonymized_at IS NULL`,
        [ceremonyId],
      ),
      pool.query<{ ukuran: string; jumlah: number }>(
        `SELECT toga_size AS ukuran, COUNT(*)::int AS jumlah
           FROM students
          WHERE ceremony_id = $1 AND is_active = TRUE AND anonymized_at IS NULL AND toga_size IS NOT NULL
          GROUP BY toga_size`,
        [ceremonyId],
      ),
      pool.query<{
        angkatan: number;
        total_kandidat: number;
        terdaftar: number;
        laki_laki: number;
        perempuan: number;
      }>(
        `SELECT COALESCE(cohort_year, 2022)::int AS angkatan,
                COUNT(*)::int AS total_kandidat,
                COUNT(*) FILTER (WHERE registration_status = 'terdaftar')::int AS terdaftar,
                COUNT(*) FILTER (WHERE gender = 'Laki-laki')::int AS laki_laki,
                COUNT(*) FILTER (WHERE gender = 'Perempuan')::int AS perempuan
           FROM students
          WHERE ceremony_id = $1 AND is_active = TRUE AND anonymized_at IS NULL
          GROUP BY COALESCE(cohort_year, 2022)
          ORDER BY angkatan DESC`,
        [ceremonyId],
      ),
      pool.query<{
        study_program: string;
        total_kandidat: number;
        layak: number;
        terdaftar: number;
        belum_daftar: number;
        laki_laki: number;
        perempuan: number;
        rata_ipk: string | null;
      }>(
        `SELECT study_program,
                COUNT(*)::int AS total_kandidat,
                COUNT(*) FILTER (WHERE is_paid AND is_yudisium)::int AS layak,
                COUNT(*) FILTER (WHERE registration_status = 'terdaftar')::int AS terdaftar,
                COUNT(*) FILTER (WHERE is_paid AND is_yudisium AND registration_status = 'belum_daftar')::int AS belum_daftar,
                COUNT(*) FILTER (WHERE gender = 'Laki-laki')::int AS laki_laki,
                COUNT(*) FILTER (WHERE gender = 'Perempuan')::int AS perempuan,
                ROUND(AVG(gpa), 2)::text AS rata_ipk
           FROM students
          WHERE ceremony_id = $1 AND is_active = TRUE AND anonymized_at IS NULL
          GROUP BY study_program
          ORDER BY study_program`,
        [ceremonyId],
      ),
      pool.query<{
        id: number;
        nim: string;
        name: string;
        study_program: string;
        gender: string | null;
        toga_size: string | null;
        gpa: string | null;
        registered_at: Date | null;
      }>(
        `SELECT id, nim, name, study_program, gender, toga_size, gpa::text AS gpa, registered_at
           FROM students
          WHERE ceremony_id = $1 AND is_active = TRUE AND anonymized_at IS NULL AND registration_status = 'terdaftar'
          ORDER BY registered_at DESC NULLS LAST, updated_at DESC
          LIMIT 8`,
        [ceremonyId],
      ),
    ]);

    const t = totalsRes.rows[0] ?? {
      total: 0,
      paid: 0,
      yudisium: 0,
      eligible: 0,
      registered: 0,
      blocked: 0,
      unregistered_eligible: 0,
      avg_gpa: null,
      laki_laki: 0,
      perempuan: 0,
    };
    const togaMap = new Map(togaRes.rows.map((r) => [r.ukuran, r.jumlah]));
    const byToga = ["M", "L", "XL", "XXL", "XXXL", "XXXXL"].map((sz) => ({
      ukuran: sz,
      jumlah: togaMap.get(sz) ?? 0,
    }));

    return ok(reply, {
      total: t.total,
      paid: t.paid,
      yudisium: t.yudisium,
      eligible: t.eligible,
      registered: t.registered,
      blocked: t.blocked,
      unregistered_eligible: t.unregistered_eligible,
      avg_gpa: t.avg_gpa,
      by_gender: {
        laki_laki: t.laki_laki,
        perempuan: t.perempuan,
      },
      by_toga: byToga,
      by_angkatan: angkatanRes.rows,
      by_prodi: prodiRes.rows.map((p) => {
        const match = p.study_program.match(/^(S1|S2|S3|D3|D4|Profesi)\b/i);
        return {
          ...p,
          jenjang: match ? match[1]!.toUpperCase() : "S1",
        };
      }),
      recent_registrants: recentRes.rows,
    });
  });

  // ---------- Superadmin: kelola wisudawan satu per satu ----------
  app.get("/api/v1/admin/students", async (request, reply) => {
    if (!(await requireAuth(request, reply, ["superadmin"]))) return reply;
    const q = query(request);
    const page = pagination(q);
    const search = str(q.search, 100);
    const filter = str(q.filter, 30);
    const studyProgramFilter = str(q.study_program, 160);
    const genderFilter = str(q.gender, 20);
    const togaFilter = str(q.toga_size, 10).toUpperCase();
    const pattern = search ? `%${search.replace(/[\\%_]/g, "\\$&")}%` : null;
    const ceremonyId = await currentCeremonyId();

    let filterClause = "";
    if (filter === "layak") filterClause = " AND is_paid = TRUE AND is_yudisium = TRUE";
    else if (filter === "belum_lunas") filterClause = " AND is_paid = FALSE";
    else if (filter === "belum_yudisium") filterClause = " AND is_yudisium = FALSE";
    else if (filter === "terdaftar") filterClause = " AND registration_status = 'terdaftar'";
    else if (filter === "belum_daftar")
      filterClause =
        " AND is_paid = TRUE AND is_yudisium = TRUE AND registration_status = 'belum_daftar'";

    const where = `WHERE ceremony_id = $1
      AND ($2::text IS NULL OR nim ILIKE $2 OR name ILIKE $2 OR study_program ILIKE $2)
      AND ($3::text = '' OR study_program = $3)
      AND ($4::text = '' OR gender = $4)
      AND ($5::text = '' OR toga_size = $5)${filterClause}`;
    const [count, rows] = await Promise.all([
      pool.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM students ${where}`, [
        ceremonyId,
        pattern,
        studyProgramFilter,
        genderFilter,
        togaFilter,
      ]),
      pool.query<{
        id: number;
        nim: string;
        name: string;
        study_program: string;
        cohort_year: number | null;
        graduation_date_text: string | null;
        is_paid: boolean;
        is_yudisium: boolean;
        eligibility_note: string | null;
        registration_status: string;
        registered_at: Date | null;
        gender: string | null;
        toga_size: string | null;
        birth_place: string | null;
        birth_date: string | null;
        phone: string | null;
        email: string | null;
        gpa: string | null;
        graduation_date: string | null;
        thesis_title: string | null;
        has_photo: boolean;
        is_active: boolean;
        anonymized_at: Date | null;
        updated_at: Date;
      }>(
        `SELECT id, nim, name, study_program, cohort_year, graduation_date_text,
                is_paid, is_yudisium, eligibility_note, registration_status, registered_at,
                gender, toga_size, birth_place, to_char(birth_date, 'YYYY-MM-DD') AS birth_date,
                phone, email, gpa::text AS gpa, to_char(graduation_date, 'YYYY-MM-DD') AS graduation_date,
                thesis_title, (photo_data IS NOT NULL) AS has_photo,
                is_active, anonymized_at, updated_at
           FROM students ${where} ORDER BY study_program, name, nim LIMIT $6 OFFSET $7`,
        [
          ceremonyId,
          pattern,
          studyProgramFilter,
          genderFilter,
          togaFilter,
          page.perPage,
          page.offset,
        ],
      ),
    ]);
    return ok(
      reply,
      rows.rows.map((r) => ({
        ...r,
        qr_url: r.anonymized_at ? null : signedQrUrl(r.id),
      })),
      pageMeta(page, count.rows[0]?.total ?? 0),
    );
  });

  app.post("/api/v1/admin/students", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    const input = readStudentInput(body(request));
    if (typeof input === "string") return fail(reply, 422, input);
    try {
      const result = await pool.query<{ id: number }>(
        `INSERT INTO students
           (ceremony_id, nim, name, study_program, cohort_year, graduation_date_text,
            is_paid, is_yudisium, eligibility_note, gender, toga_size, attendance_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [
          await currentCeremonyId(),
          input.nim,
          input.name,
          input.studyProgram,
          input.cohortYear,
          input.graduationDateText,
          input.isPaid,
          input.isYudisium,
          input.eligibilityNote,
          input.gender,
          input.togaSize,
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
                graduation_date_text = $6, is_paid = $7, is_yudisium = $8, eligibility_note = $9,
                gender = COALESCE($10, gender), toga_size = COALESCE($11, toga_size),
                updated_at = NOW()
          WHERE id = $1 AND anonymized_at IS NULL`,
        [
          id,
          input.nim,
          input.name,
          input.studyProgram,
          input.cohortYear,
          input.graduationDateText,
          input.isPaid,
          input.isYudisium,
          input.eligibilityNote,
          input.gender,
          input.togaSize,
        ],
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

  app.post("/api/v1/admin/students/:id/eligibility", async (request, reply) => {
    const auth = await requireAuth(request, reply, ["superadmin"], { mutation: true });
    if (!auth) return reply;
    const id = positiveId(params(request).id);
    if (!id) return fail(reply, 422, "Wisudawan tidak valid.");
    const b = body(request);
    const isPaid = b.is_paid === undefined ? null : Boolean(b.is_paid);
    const isYudisium = b.is_yudisium === undefined ? null : Boolean(b.is_yudisium);
    const note =
      b.eligibility_note === undefined ? undefined : str(b.eligibility_note, 500) || null;

    const result = await pool.query<{
      id: number;
      is_paid: boolean;
      is_yudisium: boolean;
      eligibility_note: string | null;
    }>(
      `UPDATE students
          SET is_paid = COALESCE($2, is_paid),
              is_yudisium = COALESCE($3, is_yudisium),
              eligibility_note = CASE WHEN $4::boolean THEN $5 ELSE eligibility_note END,
              updated_at = NOW()
        WHERE id = $1 AND anonymized_at IS NULL
        RETURNING id, is_paid, is_yudisium, eligibility_note`,
      [id, isPaid, isYudisium, note !== undefined, note ?? null],
    );
    const updatedRow = result.rows[0];
    if (!updatedRow) return fail(reply, 404, "Wisudawan tidak ditemukan.");
    await audit(request, auth.user.id, "student_eligibility_updated", {
      entity: "students",
      entityId: id,
      detail: { is_paid: updatedRow.is_paid, is_yudisium: updatedRow.is_yudisium },
    });
    return ok(reply, updatedRow);
  });

  app.get("/api/v1/admin/students/:id/photo", async (request, reply) => {
    if (!(await requireAuth(request, reply, ["superadmin"]))) return reply;
    const id = positiveId(params(request).id);
    if (!id) return fail(reply, 422, "Wisudawan tidak valid.");
    const res = await pool.query<{
      nim: string;
      photo_mime: string | null;
      photo_data: Buffer | null;
    }>("SELECT nim, photo_mime, photo_data FROM students WHERE id = $1 AND anonymized_at IS NULL", [
      id,
    ]);
    const row = res.rows[0];
    if (!row || !row.photo_data || !row.photo_mime) {
      return fail(reply, 404, "Foto belum diunggah.");
    }
    return reply
      .header("Cache-Control", "private, no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Security-Policy", "sandbox")
      .type(row.photo_mime)
      .send(row.photo_data);
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
