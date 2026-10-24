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

interface DemoStudent {
  nim: string;
  name: string;
  program: string;
  cohort: number;
  isPaid: boolean;
  isYudisium: boolean;
  note: string | null;
  status: "belum_daftar" | "terdaftar";
  gender: "Laki-laki" | "Perempuan";
  togaSize: string | null;
  gpa: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  gradDate: string | null;
  thesis: string | null;
}

const STUDENTS: DemoStudent[] = [
  {
    nim: "20260001",
    name: "Ani Rekaan",
    program: "S1 Teknik Informatika",
    cohort: 2022,
    isPaid: true,
    isYudisium: true,
    note: null,
    status: "terdaftar",
    gender: "Perempuan",
    togaSize: "M",
    gpa: "3.88",
    birthPlace: "Bandung",
    birthDate: "2004-04-12",
    phone: "081234560001",
    email: "ani.rekaan@demo.local",
    gradDate: "2026-08-20",
    thesis: "Sistem Deteksi Anomali Jaringan Kampus Berbasis Pembelajaran Mesin",
  },
  {
    nim: "20260002",
    name: "Budi Rekaan",
    program: "S1 Manajemen",
    cohort: 2022,
    isPaid: true,
    isYudisium: true,
    note: null,
    status: "belum_daftar",
    gender: "Laki-laki",
    togaSize: "L",
    gpa: null,
    birthPlace: null,
    birthDate: null,
    phone: null,
    email: null,
    gradDate: null,
    thesis: null,
  },
  {
    nim: "20260003",
    name: "Cici Rekaan",
    program: "S2 Ilmu Hukum",
    cohort: 2024,
    isPaid: false,
    isYudisium: true,
    note: "Tunggakan biaya wisuda Rp 500.000",
    status: "belum_daftar",
    gender: "Perempuan",
    togaSize: null,
    gpa: null,
    birthPlace: null,
    birthDate: null,
    phone: null,
    email: null,
    gradDate: null,
    thesis: null,
  },
  {
    nim: "20260004",
    name: "Dedi Rekaan",
    program: "S1 Agroteknologi",
    cohort: 2021,
    isPaid: true,
    isYudisium: false,
    note: "Berkas yudisium belum diserahkan",
    status: "belum_daftar",
    gender: "Laki-laki",
    togaSize: null,
    gpa: null,
    birthPlace: null,
    birthDate: null,
    phone: null,
    email: null,
    gradDate: null,
    thesis: null,
  },
  {
    nim: "20260005",
    name: "Eka Rekaan",
    program: "S1 Teknik Informatika",
    cohort: 2022,
    isPaid: false,
    isYudisium: false,
    note: "Belum melunasi biaya & belum yudisium",
    status: "belum_daftar",
    gender: "Laki-laki",
    togaSize: null,
    gpa: null,
    birthPlace: null,
    birthDate: null,
    phone: null,
    email: null,
    gradDate: null,
    thesis: null,
  },
  {
    nim: "20260006",
    name: "Fani Rekaan",
    program: "S3 Ilmu Pendidikan",
    cohort: 2023,
    isPaid: true,
    isYudisium: true,
    note: null,
    status: "terdaftar",
    gender: "Perempuan",
    togaSize: "L",
    gpa: "3.95",
    birthPlace: "Garut",
    birthDate: "1992-11-05",
    phone: "081234560006",
    email: "fani.rekaan@demo.local",
    gradDate: "2026-08-18",
    thesis: "Model Kepemimpinan Transformasional Kepala Sekolah di Jawa Barat",
  },
  {
    nim: "20260007",
    name: "Gita Rekaan",
    program: "S1 Manajemen",
    cohort: 2022,
    isPaid: true,
    isYudisium: true,
    note: null,
    status: "terdaftar",
    gender: "Perempuan",
    togaSize: "XL",
    gpa: "3.74",
    birthPlace: "Cimahi",
    birthDate: "2003-09-21",
    phone: "081234560007",
    email: "gita.rekaan@demo.local",
    gradDate: "2026-08-22",
    thesis: "Analisis Pengaruh Literasi Keuangan Digital Terhadap UMKM Kota Bandung",
  },
  {
    nim: "20260008",
    name: "Hadi Rekaan",
    program: "S2 Administrasi Pendidikan",
    cohort: 2024,
    isPaid: true,
    isYudisium: true,
    note: null,
    status: "terdaftar",
    gender: "Laki-laki",
    togaSize: "XXL",
    gpa: "3.82",
    birthPlace: "Sumedang",
    birthDate: "1998-02-14",
    phone: "081234560008",
    email: "hadi.rekaan@demo.local",
    gradDate: "2026-08-25",
    thesis: "Evaluasi Implementasi Kurikulum Merdeka pada SMA Negeri di Kabupaten Bandung",
  },
];

async function ensureUser(email: string, name: string, role: string): Promise<string | null> {
  const password = process.env.DEMO_PASSWORD || "AdminWisuda70!";
  const hash = await hashPassword(password);
  const exists = await pool.query("SELECT 1 FROM users WHERE LOWER(email) = $1", [email]);
  if (exists.rowCount) {
    await pool.query(
      "UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL, is_active = TRUE WHERE LOWER(email) = $1",
      [email, hash],
    );
    return password;
  }
  await pool.query("INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)", [
    name,
    email,
    hash,
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

  for (const s of STUDENTS) {
    await pool.query(
      `INSERT INTO students (
         ceremony_id, nim, name, study_program, cohort_year,
         is_paid, is_yudisium, eligibility_note,
         registration_status, registered_at,
         gender, toga_size, gpa, birth_place, birth_date,
         phone, email, graduation_date, thesis_title,
         attendance_token
       )
       VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9::text, CASE WHEN $9::text = 'terdaftar' THEN NOW() ELSE NULL END,
         $10, $11, $12::numeric, $13, $14::date,
         $15, $16, $17::date, $18,
         $19
       )
       ON CONFLICT (ceremony_id, nim) DO UPDATE SET
         cohort_year = COALESCE(students.cohort_year, EXCLUDED.cohort_year),
         is_paid = EXCLUDED.is_paid,
         is_yudisium = EXCLUDED.is_yudisium,
         eligibility_note = EXCLUDED.eligibility_note,
         registration_status = CASE WHEN students.registration_status = 'terdaftar' THEN 'terdaftar' ELSE EXCLUDED.registration_status END,
         registered_at = COALESCE(students.registered_at, EXCLUDED.registered_at),
         gender = COALESCE(students.gender, EXCLUDED.gender),
         toga_size = COALESCE(students.toga_size, EXCLUDED.toga_size),
         gpa = COALESCE(students.gpa, EXCLUDED.gpa),
         birth_place = COALESCE(students.birth_place, EXCLUDED.birth_place),
         birth_date = COALESCE(students.birth_date, EXCLUDED.birth_date),
         phone = COALESCE(students.phone, EXCLUDED.phone),
         email = COALESCE(students.email, EXCLUDED.email),
         graduation_date = COALESCE(students.graduation_date, EXCLUDED.graduation_date),
         thesis_title = COALESCE(students.thesis_title, EXCLUDED.thesis_title)`,
      [
        ceremonyId,
        s.nim,
        s.name,
        s.program,
        s.cohort,
        s.isPaid,
        s.isYudisium,
        s.note,
        s.status,
        s.gender,
        s.togaSize,
        s.gpa,
        s.birthPlace,
        s.birthDate,
        s.phone,
        s.email,
        s.gradDate,
        s.thesis,
        randomBytes(16).toString("hex"),
      ],
    );
  }

  const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  await pool.query("UPDATE attendance_sessions SET is_active = FALSE WHERE is_active = TRUE");
  const existingSession = await pool.query<{ id: number }>(
    "SELECT id FROM attendance_sessions WHERE ceremony_id = $1 AND event_date = $2::date AND LOWER(name) = LOWER('Gladi Resik (DEMO)')",
    [ceremonyId, date],
  );
  if (existingSession.rows[0]) {
    await pool.query(
      "UPDATE attendance_sessions SET starts_at = $2, ends_at = $3, is_active = TRUE, updated_at = NOW() WHERE id = $1",
      [existingSession.rows[0].id, `${date}T00:00:00+07:00`, `${date}T23:59:59+07:00`],
    );
  } else {
    await pool.query(
      `INSERT INTO attendance_sessions (ceremony_id, kind, name, event_date, starts_at, ends_at, is_active)
       VALUES ($1, 'gladi', 'Gladi Resik (DEMO)', $2::date, $3, $4, TRUE)`,
      [ceremonyId, date, `${date}T00:00:00+07:00`, `${date}T23:59:59+07:00`],
    );
  }

  console.log(
    `Wisudawan rekaan: ${STUDENTS.length} (NIM ${STUDENTS[0]!.nim}–${STUDENTS.at(-1)!.nim}).`,
  );
  console.log(`Sesi aktif hari ini (${date} WIB): "Gladi Resik (DEMO)", jam 00:00–23:59.`);
  for (const [email, name, role] of [
    ["petugas@demo.local", "Petugas Demo", "petugas"],
    ["super@demo.local", "Superadmin Demo", "superadmin"],
    ["koordinator@demo.local", "Koordinator Demo (Acara)", "koordinator"],
    ["ketua@demo.local", "Ketua Demo", "ketua"],
  ] as const) {
    const password = await ensureUser(email, name, role);
    console.log(
      password
        ? `Akun ${role}: ${email}  kata sandi (tampil sekali): ${password}`
        : `Akun ${role}: ${email}  (sudah ada, kata sandi tidak diubah)`,
    );
  }
  await seedTimeline();
}

/** Contoh divisi dan pekerjaan untuk mencoba timeline (nama divisi hanya contoh). */
async function seedTimeline(): Promise<void> {
  const owner = await pool.query<{ id: number }>(
    "SELECT id FROM users WHERE email = 'koordinator@demo.local'",
  );
  const ownerId = owner.rows[0]?.id;
  if (!ownerId) return;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const day = (offset: number) =>
    new Date(Date.parse(`${today}T12:00:00+07:00`) + offset * 86_400_000).toLocaleDateString(
      "en-CA",
      {
        timeZone: "Asia/Jakarta",
      },
    );
  const plan: Array<[string, Array<[string, string, number | null]>]> = [
    [
      "Acara (DEMO)",
      [
        ["Susun rundown hari-H", "berjalan", 10],
        ["Konfirmasi pengisi acara", "belum", 20],
        ["Gladi resik internal", "belum", 40],
      ],
    ],
    [
      "Konsumsi (DEMO)",
      [
        ["Survei katering", "selesai", -2],
        ["Pesan konsumsi tamu", "tertunda", -1],
      ],
    ],
    ["Dokumentasi (DEMO)", [["Jadwal fotografer", "berjalan", 15]]],
  ];
  for (const [name, tasks] of plan) {
    const division = await pool.query<{ id: number }>(
      "INSERT INTO divisions (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
      [name],
    );
    const divisionId = division.rows[0]!.id;
    if (name.startsWith("Acara")) {
      await pool.query(
        "INSERT INTO user_divisions (user_id, division_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [ownerId, divisionId],
      );
    }
    const existing = await pool.query("SELECT 1 FROM tasks WHERE division_id = $1 LIMIT 1", [
      divisionId,
    ]);
    if (existing.rowCount) continue;
    for (const [title, status, offset] of tasks) {
      await pool.query(
        "INSERT INTO tasks (division_id, title, status, end_date, created_by) VALUES ($1, $2, $3, $4, $5)",
        [divisionId, title, status, offset === null ? null : day(offset), ownerId],
      );
    }
  }
  console.log(
    "Timeline demo: 3 divisi contoh; koordinator@demo.local memegang divisi Acara (DEMO).",
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
