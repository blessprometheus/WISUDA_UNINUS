// Klaster PostgreSQL SEMENTARA dan TERISOLASI khusus tes (port 55433, data di .tmp/pg-test).
// Tidak menyentuh layanan PostgreSQL lain di komputer ini.
//   node server/scripts/test-db.mjs start | stop | reset
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const PORT = 55433;
const root = path.resolve(import.meta.dirname, "../..");
const dataDir = path.join(root, ".tmp", "pg-test");
const logFile = path.join(root, ".tmp", "pg-test.log");
const bin = process.env.PG_BIN ?? "C:\\Program Files\\PostgreSQL\\17\\bin";
const exe = (name) => path.join(bin, process.platform === "win32" ? `${name}.exe` : name);
const run = (name, args) => execFileSync(exe(name), args, { stdio: "inherit" });

const command = process.argv[2];
if (command === "start") {
  mkdirSync(path.dirname(dataDir), { recursive: true });
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    run("initdb", ["-D", dataDir, "-U", "wisuda_test", "-A", "trust", "-E", "UTF8", "--locale=C"]);
  }
  try {
    // stdio "ignore": server mewarisi aliran output; tanpa ini perintah ini tidak pernah selesai di Windows.
    execFileSync(
      exe("pg_ctl"),
      [
        "-D",
        dataDir,
        "-o",
        `-p ${PORT} -c listen_addresses=127.0.0.1`,
        "-l",
        logFile,
        "-w",
        "start",
      ],
      { stdio: "ignore" },
    );
  } catch {
    console.error("pg_ctl start gagal (mungkin sudah berjalan). Lihat .tmp/pg-test.log");
  }
  try {
    run("createdb", ["-h", "127.0.0.1", "-p", String(PORT), "-U", "wisuda_test", "wisuda_test"]);
  } catch {
    // database sudah ada
  }
  console.log(`DATABASE_URL tes: postgres://wisuda_test@127.0.0.1:${PORT}/wisuda_test`);
} else if (command === "stop") {
  run("pg_ctl", ["-D", dataDir, "-m", "fast", "-w", "stop"]);
} else if (command === "reset") {
  try {
    run("pg_ctl", ["-D", dataDir, "-m", "fast", "-w", "stop"]);
  } catch {
    // tidak berjalan
  }
  rmSync(dataDir, { recursive: true, force: true });
  console.log("Klaster tes dihapus.");
} else {
  console.error("Gunakan: start | stop | reset");
  process.exitCode = 1;
}
