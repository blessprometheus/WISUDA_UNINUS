import { randomBytes } from "node:crypto";

import { hashPassword } from "../src/auth/password.js";
import { config } from "../src/config.js";
import { pool } from "../src/db.js";

/**
 * Data DEMO untuk uji lokal (wisudawan rekaan + akun uji + sesi aktif hari ini).
 * Menolak berjalan kecuali database lokal yang namanya memuat dev/demo/test.
 * JANGAN pernah dipakai di server produksi atau dengan data wisudawan asli.
 */
const url = new URL(config.databaseUrl);
if (!["127.0.0.1", "localhost"].includes(url.hostname) || !/(dev|demo|test)/.test(url.pathname)) {
  throw new Error("seed-demo hanya boleh untuk database lokal yang namanya memuat dev/demo/test.");
}

const STUDENTS: Array<[string, string, string]> = [
  ["20260001", "Ani Rekaan", "S1 Teknik Informatika"],
  ["20260002", "Budi Rekaan", "S1 Manajemen"],
  ["20260003", "Cici Rekaan", "S2 Ilmu Hukum"],
  ["20260004", "Dedi Rekaan", "S1 Agroteknologi"],
  ["20260005", "Eka Rekaan", "S1 Teknik Informatika"],
  ["20260006", "Fani Rekaan", "S3 Ilmu Pendidikan"],
  ["20260007", "Gita Rekaan", "S1 Manajemen"],
  ["20260008", "Hadi Rekaan", "S2 Administrasi Pendidikan"],
];

async function ensureUser(email: string, name: string, role: string): Promise<string | null> {
  const exists = await pool.query("SELECT 1 FROM users WHERE LOWER(email) = $1", [email]);
  if (exists.rowCount) return null;
  const password = `${randomBytes(12).toString("base64url")}!9a`;
  await pool.query("INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)", [
    name,
    email,
    await hashPassword(password),
    role,
  ]);
  return password;
}

async function main(): Promise<void> {
  const ceremony = await pool.query<{ id: number }>(
    "SELECT id FROM ceremonies ORDER BY number DESC LIMIT 1",
  );
  const ceremonyId = ceremony.rows[0]?.id;
  if (!ceremonyId) throw new Error("Jalankan npm run db:migrate dulu.");

  for (const [nim, name, program] of STUDENTS) {
    await pool.query(
      `INSERT INTO students (ceremony_id, nim, name, study_program, attendance_token)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (ceremony_id, nim) DO NOTHING`,
      [ceremonyId, nim, name, program, randomBytes(16).toString("hex")],
    );
  }

  const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  await pool.query(
    `INSERT INTO attendance_sessions (ceremony_id, kind, name, event_date, starts_at, ends_at, is_active)
     VALUES ($1, 'gladi', 'Gladi Resik (DEMO)', $2::date, $3, $4, TRUE)
     ON CONFLICT (ceremony_id, event_date) DO UPDATE
       SET starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, is_active = TRUE, updated_at = NOW()`,
    [ceremonyId, date, `${date}T00:00:00+07:00`, `${date}T23:59:59+07:00`],
  );

  console.log(
    `Wisudawan rekaan: ${STUDENTS.length} (NIM ${STUDENTS[0]![0]}–${STUDENTS.at(-1)![0]}).`,
  );
  console.log(`Sesi aktif hari ini (${date} WIB): "Gladi Resik (DEMO)", jam 00:00–23:59.`);
  for (const [email, name, role] of [
    ["petugas@demo.local", "Petugas Demo", "petugas"],
    ["super@demo.local", "Superadmin Demo", "superadmin"],
  ] as const) {
    const password = await ensureUser(email, name, role);
    console.log(
      password
        ? `Akun ${role}: ${email}  kata sandi (tampil sekali): ${password}`
        : `Akun ${role}: ${email}  (sudah ada, kata sandi tidak diubah)`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
