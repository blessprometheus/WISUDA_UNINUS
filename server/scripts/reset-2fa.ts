import { parseArgs } from "node:util";

import { pool } from "../src/db.js";

/**
 * AKSES DARURAT: mematikan 2FA satu akun (mis. superadmin kehilangan HP dan kode pemulihan).
 * Dijalankan di server oleh pemilik proyek. Akun diwajibkan mendaftarkan 2FA lagi saat login berikutnya.
 *
 *   npm run admin:reset-2fa -- --email nama@contoh.id
 */
async function main(): Promise<void> {
  const { values } = parseArgs({ options: { email: { type: "string" } } });
  const email = values.email?.trim().toLowerCase();
  if (!email) throw new Error("Isi --email.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query<{ id: number }>(
      `UPDATE users SET totp_enabled = FALSE, totp_secret_enc = NULL, totp_last_step = NULL,
              failed_logins = 0, locked_until = NULL
        WHERE LOWER(email) = $1 RETURNING id`,
      [email],
    );
    const id = user.rows[0]?.id;
    if (!id) throw new Error("Email tidak ditemukan.");
    await client.query("DELETE FROM recovery_codes WHERE user_id = $1", [id]);
    await client.query("DELETE FROM user_sessions WHERE user_id = $1", [id]);
    await client.query(
      "INSERT INTO audit_log (user_id, action, entity, entity_id, detail) VALUES (NULL, 'user_2fa_reset_cli', 'users', $1, '{}'::jsonb)",
      [id],
    );
    await client.query("COMMIT");
    console.log(
      `2FA akun ${email} dimatikan dan semua sesinya dicabut. Daftarkan 2FA lagi saat login.`,
    );
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
