// Klaster PostgreSQL SEMENTARA dan TERISOLASI khusus tes (port 55433, data di .tmp/pg-test).
// Tidak menyentuh layanan PostgreSQL lain di komputer ini.
//   node server/scripts/test-db.mjs start | stop | reset
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const PORT = 55433;
const root = path.resolve(import.meta.dirname, "../..");
const dataDir = path.join(root, ".tmp", "pg-test");
const logFile = path.join(root, ".tmp", "pg-test.log");
// PG_BIN opsional; gunakan instalasi pada PATH bila tidak diatur.
const bin = process.env.PG_BIN?.trim();
const exe = (name) => {
  const filename = process.platform === "win32" ? `${name}.exe` : name;
  return bin ? path.join(bin, filename) : filename;
};
const run = (name, args) => execFileSync(exe(name), args, { stdio: "inherit" });
const read = (name, args) =>
  execFileSync(exe(name), args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

function isRunning() {
  try {
    read("pg_ctl", ["-D", dataDir, "status"]);
    return true;
  } catch (error) {
    if (error.status === 3) return false;
    throw error;
  }
}

const command = process.argv[2];
try {
  const version = read("pg_ctl", ["--version"]).match(/PostgreSQL\) (\d+)/)?.[1];
  const versionFile = path.join(dataDir, "PG_VERSION");
  if (existsSync(versionFile) && readFileSync(versionFile, "utf8").trim() !== version) {
    throw new Error(
      "Versi PostgreSQL tidak cocok dengan klaster lokal. Atur PG_BIN ke versi pada .tmp/pg-test/PG_VERSION; jangan hapus data klaster.",
    );
  }
  if (command === "start") {
    mkdirSync(path.dirname(dataDir), { recursive: true });
    if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
      run("initdb", [
        "-D",
        dataDir,
        "-U",
        "wisuda_test",
        "-A",
        "trust",
        "-E",
        "UTF8",
        "--locale=C",
      ]);
    }
    if (!isRunning()) {
      // stdio "ignore": server mewarisi aliran output; tanpa ini perintah ini tidak pernah selesai di Windows.
      try {
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
        throw new Error("PostgreSQL gagal dimulai. Periksa .tmp/pg-test.log; database belum siap.");
      }
    }
    // Kueri harus berhasil sebelum menyatakan database siap. Jangan menyamarkan
    // kegagalan koneksi sebagai 'database sudah ada'. -w mencegah prompt sandi.
    const connection = ["-X", "-w", "-h", "127.0.0.1", "-p", String(PORT), "-U", "wisuda_test"];
    const exists = read("psql", [
      ...connection,
      "-d",
      "postgres",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "SELECT 1 FROM pg_database WHERE datname = 'wisuda_test'",
    ]);
    if (exists !== "1") {
      run("createdb", ["-h", "127.0.0.1", "-p", String(PORT), "-U", "wisuda_test", "wisuda_test"]);
    }
    read("psql", [
      ...connection,
      "-d",
      "wisuda_test",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "SELECT 1",
    ]);
    console.log(`PostgreSQL ${version} siap di 127.0.0.1:${PORT}.`);
    console.log(`DATABASE_URL tes: postgres://wisuda_test@127.0.0.1:${PORT}/wisuda_test`);
  } else if (command === "stop") {
    run("pg_ctl", ["-D", dataDir, "-m", "fast", "-w", "stop"]);
  } else if (command === "reset") {
    if (isRunning()) {
      run("pg_ctl", ["-D", dataDir, "-m", "fast", "-w", "stop"]);
    }
    rmSync(dataDir, { recursive: true, force: true });
    console.log("Klaster tes dihapus.");
  } else {
    console.error("Gunakan: start | stop | reset");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(
    error.code === "ENOENT"
      ? "Program PostgreSQL tidak ditemukan. Tambahkan folder bin PostgreSQL ke PATH atau atur PG_BIN ke folder instalasi yang benar."
      : error.message,
  );
  process.exitCode = 1;
}
