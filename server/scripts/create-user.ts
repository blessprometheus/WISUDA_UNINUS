import { parseArgs } from "node:util";

import { generatePassword, hashPassword, passwordProblem } from "../src/auth/password.js";
import { ALL_ROLES, type Role } from "../src/auth/session.js";
import { pool } from "../src/db.js";

/**
 * Buat pengguna. Kata sandi acak dicetak SEKALI ke terminal; simpan di pengelola kata sandi.
 *
 *   npm run admin:create -- --email nama@contoh.id --name "Nama" --role superadmin
 */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      role: { type: "string", default: "superadmin" },
    },
  });
  const email = values.email?.trim().toLowerCase() ?? "";
  const name = values.name?.trim() ?? "";
  const role = values.role as Role;
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 160 ||
    !name ||
    name.length > 160
  ) {
    throw new Error("Isi --email yang valid dan --name (maksimal 160 karakter).");
  }
  if (!ALL_ROLES.includes(role))
    throw new Error(`--role harus salah satu dari: ${ALL_ROLES.join(", ")}.`);

  const password = generatePassword();
  if (passwordProblem(password)) throw new Error("Kata sandi acak tidak memenuhi kebijakan.");
  const result = await pool.query<{ id: number }>(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, email, await hashPassword(password), role],
  );
  console.log(`Pengguna dibuat (id ${result.rows[0]!.id}, peran ${role}).`);
  console.log(`Kata sandi sementara (tampil sekali): ${password}`);
}

main()
  .catch((error: unknown) => {
    const code = (error as { code?: string }).code;
    console.error(code === "23505" ? "Email sudah terdaftar." : (error as Error).message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
