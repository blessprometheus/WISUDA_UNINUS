import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import { pool } from "../src/db.js";
import { createAccounts, parseAccountList } from "../src/lib/bulk-accounts.js";
import { escapeCsvCell } from "../src/lib/csv.js";

/**
 * Buat banyak akun sekaligus (ketua, koordinator, petugas) dari satu daftar.
 *
 * - Baris TANPA sandi: sandi ACAK dibuat dan ditulis ke berkas keluaran (izin 600, tidak menimpa berkas lama);
 *   tidak dicetak ke terminal.
 * - Baris DENGAN sandi (kolom ke-5): sandi itu yang dipakai. Sandi tidak dicetak dan tidak dicatat; hapus berkas
 *   daftar setelah dipakai. Kebijakan sandi berlaku kecuali ENFORCE_PASSWORD_POLICY=0.
 * - --update-passwords: akun yang sudah ada dan barisnya memuat sandi akan diganti sandinya (peran harus sama).
 *
 *   npm run admin:create-accounts -- --file ~/akun.csv [--out ~/akun-baru.csv] [--update-passwords]
 *
 * Format --file: email,nama,peran,divisi[,sandi]   (divisi hanya untuk koordinator; tanpa koma di dalam sandi)
 */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      out: { type: "string" },
      "update-passwords": { type: "boolean", default: false },
    },
  });
  if (!values.file) throw new Error("Isi --file (daftar akun: email,nama,peran,divisi[,sandi]).");
  const out =
    values.out ?? path.join(homedir(), `akun-baru-${new Date().toISOString().slice(0, 10)}.csv`);

  const { specs, problems } = parseAccountList(await readFile(values.file, "utf8"));
  if (problems.length > 0) {
    throw new Error(`Daftar akun bermasalah, tidak ada yang dibuat:\n- ${problems.join("\n- ")}`);
  }
  const results = await createAccounts(specs, { updatePasswords: values["update-passwords"] });

  const created = results.filter((r) => r.status === "dibuat");
  const updated = results.filter((r) => r.status === "diperbarui");
  const skipped = results.filter((r) => r.status === "sudah_ada");
  const generated = created.filter((r) => r.password !== undefined);
  if (generated.length > 0) {
    const lines = [["email", "peran", "divisi", "kata_sandi_sementara"]].concat(
      generated.map((r) => [r.email, r.role, r.division ?? "", r.password ?? ""]),
    );
    // flag "wx": gagal bila berkas sudah ada, jadi sandi lama tidak pernah tertimpa diam-diam.
    await writeFile(out, `${lines.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}\n`, {
      mode: 0o600,
      flag: "wx",
    });
  }
  console.log(
    `Dibuat: ${created.length}; sandi diperbarui: ${updated.length}; dilewati karena email sudah ada: ${skipped.length}.`,
  );
  for (const r of skipped) console.log(`  dilewati (sudah ada): ${r.email}`);
  for (const r of updated) console.log(`  sandi diperbarui: ${r.email}`);
  if (generated.length > 0) {
    console.log(
      `Sandi acak untuk ${generated.length} akun ditulis ke ${out} (izin 600). Sandi tidak ditampilkan di sini.`,
    );
    console.log("Serahkan tiap sandi lewat jalur aman, lalu hapus berkas itu.");
  }
  if (created.length + updated.length > generated.length) {
    console.log("Sandi pilihan sendiri tidak dicetak. Hapus berkas daftar akun yang memuat sandi.");
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
