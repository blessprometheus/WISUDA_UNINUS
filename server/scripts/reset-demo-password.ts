import { parseArgs } from "node:util";

import { generatePassword, hashPassword } from "../src/auth/password.js";
import { config } from "../src/config.js";
import { pool } from "../src/db.js";

/** Pemulihan akun demo lokal; kata sandi baru hanya ditampilkan ke terminal pemilik. */
async function main(): Promise<void> {
  const { values } = parseArgs({ options: { check: { type: "boolean", default: false } } });
  const url = new URL(config.databaseUrl);
  if (
    process.env.NODE_ENV === "production" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "55433" ||
    url.pathname !== "/wisuda_demo"
  ) {
    throw new Error("Perintah ini hanya untuk database lokal wisuda_demo pada port 55433.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query<{ id: number }>(
      "SELECT id FROM users WHERE LOWER(email) = $1 AND role = 'superadmin' AND is_active = TRUE FOR UPDATE",
      ["super@demo.local"],
    );
    const id = user.rows[0]?.id;
    if (!id) throw new Error("Akun superadmin demo aktif tidak ditemukan.");
    if (values.check) {
      await client.query("ROLLBACK");
      console.log("Akun super@demo.local siap direset di wisuda_demo. Belum ada perubahan.");
      return;
    }

    const password = generatePassword();
    await client.query(
      "UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL WHERE id = $1",
      [id, await hashPassword(password)],
    );
    await client.query("DELETE FROM user_sessions WHERE user_id = $1", [id]);
    await client.query(
      "INSERT INTO audit_log (user_id, action, entity, entity_id, detail) VALUES (NULL, 'user_password_reset_demo_cli', 'users', $1, '{}'::jsonb)",
      [id],
    );
    await client.query("COMMIT");
    console.log("Email: super@demo.local");
    console.log(`Kata sandi baru (simpan sekarang): ${password}`);
    console.log("Sesi lama dicabut. Pengaturan 2FA tetap berlaku.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Reset kata sandi gagal.");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
