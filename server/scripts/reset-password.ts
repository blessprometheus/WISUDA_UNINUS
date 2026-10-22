import { parseArgs } from "node:util";

import { generatePassword, hashPassword } from "../src/auth/password.js";
import { pool } from "../src/db.js";

/**
 * AKSES DARURAT: mengganti kata sandi satu akun dengan sandi acak sementara (mis. superadmin lupa kata sandi).
 * Dijalankan di server oleh pemilik proyek. Semua sesi akun dicabut dan penguncian login dibuka.
 * Sandi sementara dicetak SEKALI ke terminal; simpan di pengelola kata sandi.
 *
 *   npm run admin:reset-password -- --email nama@contoh.id
 */
async function main(): Promise<void> {
  const { values } = parseArgs({ options: { email: { type: "string" } } });
  const email = values.email?.trim().toLowerCase();
  if (!email) throw new Error("Isi --email.");
  const password = generatePassword();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query<{ id: number }>(
      `UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL, is_active = TRUE
        WHERE LOWER(email) = $1 RETURNING id`,
      [email, await hashPassword(password)],
    );
    const id = user.rows[0]?.id;
    if (!id) throw new Error("Email tidak ditemukan.");
    await client.query("DELETE FROM user_sessions WHERE user_id = $1", [id]);
    await client.query(
      "INSERT INTO audit_log (user_id, action, entity, entity_id, detail) VALUES (NULL, 'user_password_reset_cli', 'users', $1, '{}'::jsonb)",
      [id],
    );
    await client.query("COMMIT");
    console.log(`Kata sandi akun ${email} diganti dan semua sesinya dicabut.`);
    console.log(`Kata sandi sementara (tampil sekali): ${password}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
