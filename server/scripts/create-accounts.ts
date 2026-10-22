import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import { pool } from "../src/db.js";
import { createAccounts, parseAccountList } from "../src/lib/bulk-accounts.js";
import { escapeCsvCell } from "../src/lib/csv.js";

/**
 * Buat banyak akun sekaligus (ketua, koordinator, petugas) dari daftar tanpa kata sandi.
 * Kata sandi ACAK dibuat per akun dan ditulis ke berkas keluaran (izin 600, tidak menimpa berkas lama);
 * TIDAK dicetak ke terminal. Setelah diserahkan ke pemiliknya, hapus berkas keluaran.
 *
 *   npm run admin:create-accounts -- --file ~/akun.csv [--out ~/akun-baru.csv]
 *
 * Format --file (tanpa kolom sandi): email,nama,peran,divisi   (divisi hanya untuk koordinator)
 */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { file: { type: "string" }, out: { type: "string" } },
  });
  if (!values.file) throw new Error("Isi --file (daftar akun: email,nama,peran,divisi).");
  const out =
    values.out ?? path.join(homedir(), `akun-baru-${new Date().toISOString().slice(0, 10)}.csv`);

  const { specs, problems } = parseAccountList(await readFile(values.file, "utf8"));
  if (problems.length > 0) {
    throw new Error(`Daftar akun bermasalah, tidak ada yang dibuat:\n- ${problems.join("\n- ")}`);
  }
  const results = await createAccounts(specs);

  const created = results.filter((r) => r.status === "dibuat");
  if (created.length > 0) {
    const lines = [["email", "peran", "divisi", "kata_sandi_sementara"]].concat(
      created.map((r) => [r.email, r.role, r.division ?? "", r.password ?? ""]),
    );
    // flag "wx": gagal bila berkas sudah ada, jadi sandi lama tidak pernah tertimpa diam-diam.
    await writeFile(out, `${lines.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}\n`, {
      mode: 0o600,
      flag: "wx",
    });
  }
  console.log(
    `Dibuat: ${created.length}; dilewati karena email sudah ada: ${results.length - created.length}.`,
  );
  for (const r of results.filter((x) => x.status === "sudah_ada")) {
    console.log(`  dilewati (sudah ada): ${r.email}`);
  }
  if (created.length > 0) {
    console.log(
      `Kata sandi sementara ditulis ke ${out} (izin 600). Sandi tidak ditampilkan di sini.`,
    );
    console.log("Serahkan tiap sandi lewat jalur aman, lalu hapus berkas itu.");
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
