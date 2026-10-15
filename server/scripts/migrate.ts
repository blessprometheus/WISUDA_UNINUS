import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pool } from "../src/db.js";

const sqlDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../sql");

/** Terapkan file server/sql/NNN_*.sql yang belum tercatat, berurutan, masing-masing dalam satu transaksi. */
async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(20261015)");
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version VARCHAR(120) PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`,
    );
    const applied = new Set(
      (await client.query<{ version: string }>("SELECT version FROM schema_migrations")).rows.map(
        (row) => row.version,
      ),
    );
    const files = (await readdir(sqlDir)).filter((name) => /^\d{3}_.+\.sql$/.test(name)).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(path.join(sqlDir, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Migrasi diterapkan: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migrasi ${file} gagal: ${(error as Error).message}`);
      }
    }
    console.log("Skema database mutakhir.");
  } finally {
    await client.query("SELECT pg_advisory_unlock(20261015)").catch(() => undefined);
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
