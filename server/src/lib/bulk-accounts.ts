import { generatePassword, hashPassword, passwordProblem } from "../auth/password.js";
import { pool } from "../db.js";

/** Peran yang boleh dibuat massal. Superadmin hanya lewat `npm run admin:create` (D41). */
export const BULK_ROLES = ["ketua", "koordinator", "petugas"] as const;
export type BulkRole = (typeof BULK_ROLES)[number];

export interface AccountSpec {
  email: string;
  name: string;
  role: BulkRole;
  /** Wajib untuk koordinator; kosong untuk peran lain. */
  division: string | null;
}

export interface CreatedAccount {
  email: string;
  role: BulkRole;
  division: string | null;
  status: "dibuat" | "sudah_ada";
  /** Hanya ada bila status = "dibuat". Jangan dicetak ke terminal atau log. */
  password?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Daftar akun berformat CSV sederhana tanpa kutip: `email,nama,peran,divisi`.
 * Baris kosong dan baris berawalan # diabaikan; baris judul (`email,...`) boleh ada.
 * Daftar ini TIDAK memuat kata sandi.
 */
export function parseAccountList(text: string): { specs: AccountSpec[]; problems: string[] } {
  const specs: AccountSpec[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const cells = line.split(",").map((cell) => cell.trim());
    if (cells[0]?.toLowerCase() === "email") return;
    const where = `Baris ${index + 1}`;
    if (cells.length < 3 || cells.length > 4) {
      problems.push(`${where}: isi 3-4 kolom (email,nama,peran,divisi).`);
      return;
    }
    const email = (cells[0] ?? "").toLowerCase();
    const name = cells[1] ?? "";
    const role = cells[2] ?? "";
    const division = cells[3] ? cells[3] : null;
    if (!EMAIL.test(email) || email.length > 160) {
      problems.push(`${where}: email tidak valid.`);
      return;
    }
    if (!name || name.length > 160) {
      problems.push(`${where}: nama wajib diisi (maksimal 160 karakter).`);
      return;
    }
    if (role === "superadmin") {
      problems.push(`${where}: peran superadmin hanya dibuat lewat "npm run admin:create".`);
      return;
    }
    if (!(BULK_ROLES as readonly string[]).includes(role)) {
      problems.push(`${where}: peran harus salah satu dari ${BULK_ROLES.join(", ")}.`);
      return;
    }
    if (role === "koordinator" && !division) {
      problems.push(`${where}: koordinator wajib punya divisi.`);
      return;
    }
    if (role !== "koordinator" && division) {
      problems.push(`${where}: kolom divisi hanya untuk koordinator.`);
      return;
    }
    if (division && division.length > 120) {
      problems.push(`${where}: nama divisi maksimal 120 karakter.`);
      return;
    }
    if (seen.has(email)) {
      problems.push(`${where}: email ganda dalam daftar.`);
      return;
    }
    seen.add(email);
    specs.push({ email, name, role: role as BulkRole, division });
  });
  if (specs.length === 0 && problems.length === 0) problems.push("Daftar akun kosong.");
  return { specs, problems };
}

/**
 * Buat semua akun dalam satu transaksi (semua berhasil atau tidak ada). Sandi acak dibuat di sini dan
 * dikembalikan sekali; email yang sudah terdaftar dilewati tanpa mengubah apa pun.
 */
export async function createAccounts(specs: readonly AccountSpec[]): Promise<CreatedAccount[]> {
  const results: CreatedAccount[] = [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const spec of specs) {
      const existing = await client.query("SELECT 1 FROM users WHERE LOWER(email) = $1", [
        spec.email,
      ]);
      if ((existing.rowCount ?? 0) > 0) {
        results.push({
          email: spec.email,
          role: spec.role,
          division: spec.division,
          status: "sudah_ada",
        });
        continue;
      }
      const password = generatePassword();
      if (passwordProblem(password)) throw new Error("Kata sandi acak tidak memenuhi kebijakan.");
      const created = await client.query<{ id: number }>(
        "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id",
        [spec.name, spec.email, await hashPassword(password), spec.role],
      );
      const userId = created.rows[0]!.id;
      if (spec.division) {
        const division = await client.query<{ id: number }>(
          `INSERT INTO divisions (name) VALUES ($1)
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [spec.division],
        );
        await client.query(
          "INSERT INTO user_divisions (user_id, division_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [userId, division.rows[0]!.id],
        );
      }
      await client.query(
        `INSERT INTO audit_log (user_id, action, entity, entity_id, detail)
         VALUES (NULL, 'user_created_cli', 'users', $1, $2::jsonb)`,
        [userId, JSON.stringify({ role: spec.role })],
      );
      results.push({
        email: spec.email,
        role: spec.role,
        division: spec.division,
        status: "dibuat",
        password,
      });
    }
    await client.query("COMMIT");
    return results;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
