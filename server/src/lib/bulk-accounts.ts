import {
  generatePassword,
  hashPassword,
  passwordProblem,
  passwordProblemFor,
} from "../auth/password.js";
import { config } from "../config.js";
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
  /** Sandi pilihan pemilik proyek (kolom ke-5). Bila kosong, sandi acak dibuat. Tidak pernah dicetak atau dicatat. */
  password?: string;
}

export interface CreatedAccount {
  email: string;
  role: BulkRole;
  division: string | null;
  status: "dibuat" | "diperbarui" | "sudah_ada";
  /** Hanya untuk sandi ACAK yang dibuat di sini. Jangan dicetak ke terminal atau log. */
  password?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Daftar akun berformat CSV sederhana tanpa kutip: `email,nama,peran,divisi[,sandi]`.
 * Baris kosong dan baris berawalan # diabaikan; baris judul (`email,...`) boleh ada.
 * Kolom sandi opsional (tanpa koma di dalam sandi); sandi diperiksa dengan kebijakan sandi kecuali
 * ENFORCE_PASSWORD_POLICY=0 (D43). Berkas daftar yang memuat sandi harus dihapus setelah dipakai.
 */
export function parseAccountList(
  text: string,
  options: { enforcePolicy?: boolean } = {},
): { specs: AccountSpec[]; problems: string[] } {
  const enforce = options.enforcePolicy ?? config.enforcePasswordPolicy;
  const specs: AccountSpec[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const cells = line.split(",").map((cell) => cell.trim());
    if (cells[0]?.toLowerCase() === "email") return;
    const where = `Baris ${index + 1}`;
    if (cells.length < 3 || cells.length > 5) {
      problems.push(`${where}: isi 3-5 kolom (email,nama,peran,divisi,sandi).`);
      return;
    }
    const email = (cells[0] ?? "").toLowerCase();
    const name = cells[1] ?? "";
    const role = cells[2] ?? "";
    const division = cells[3] ? cells[3] : null;
    const password = cells[4] ? cells[4] : undefined;
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
    if (password !== undefined) {
      const problem = passwordProblemFor(password, enforce);
      if (problem) {
        problems.push(`${where}: ${problem}`);
        return;
      }
    }
    if (seen.has(email)) {
      problems.push(`${where}: email ganda dalam daftar.`);
      return;
    }
    seen.add(email);
    specs.push({
      email,
      name,
      role: role as BulkRole,
      division,
      ...(password === undefined ? {} : { password }),
    });
  });
  if (specs.length === 0 && problems.length === 0) problems.push("Daftar akun kosong.");
  return { specs, problems };
}

/**
 * Buat semua akun dalam satu transaksi (semua berhasil atau tidak ada). Tanpa sandi di daftar, sandi acak dibuat
 * di sini dan dikembalikan sekali. Email yang sudah terdaftar dilewati tanpa mengubah apa pun, kecuali
 * `updatePasswords` dan daftar memuat sandi: sandi akun itu diganti (peran harus sama) dan semua sesinya dicabut.
 */
export async function createAccounts(
  specs: readonly AccountSpec[],
  options: { updatePasswords?: boolean } = {},
): Promise<CreatedAccount[]> {
  const results: CreatedAccount[] = [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const spec of specs) {
      const existing = await client.query<{ id: number; role: string }>(
        "SELECT id, role FROM users WHERE LOWER(email) = $1",
        [spec.email],
      );
      const found = existing.rows[0];
      if (found) {
        if (options.updatePasswords && spec.password !== undefined) {
          if (found.role !== spec.role) {
            throw new Error(
              `${spec.email}: peran di database (${found.role}) berbeda dari daftar.`,
            );
          }
          await client.query(
            `UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL, is_active = TRUE
              WHERE id = $1`,
            [found.id, await hashPassword(spec.password)],
          );
          await client.query("DELETE FROM user_sessions WHERE user_id = $1", [found.id]);
          await client.query(
            `INSERT INTO audit_log (user_id, action, entity, entity_id, detail)
             VALUES (NULL, 'user_password_reset_cli', 'users', $1, '{}'::jsonb)`,
            [found.id],
          );
          results.push({
            email: spec.email,
            role: spec.role,
            division: spec.division,
            status: "diperbarui",
          });
        } else {
          results.push({
            email: spec.email,
            role: spec.role,
            division: spec.division,
            status: "sudah_ada",
          });
        }
        continue;
      }
      const generated = spec.password === undefined;
      const password = spec.password ?? generatePassword();
      if (generated && passwordProblem(password)) {
        throw new Error("Kata sandi acak tidak memenuhi kebijakan.");
      }
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
        ...(generated ? { password } : {}),
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
