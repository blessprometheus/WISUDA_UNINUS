// Pratinjau build production di komputer: Next.js dan API hasil kompilasi.
// API memakai cookie HTTP untuk komputer; HTTPS production harus diuji di staging.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync(".next/BUILD_ID") || !existsSync("server/dist/src/index.js")) {
  console.error("Build belum tersedia. Jalankan npm run preview:build terlebih dahulu.");
  process.exit(1);
}

const children = [
  spawn(process.execPath, ["--env-file-if-exists=.env.local", "server/dist/src/index.js"], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
  }),
  spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3000"], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  }),
];

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
}

process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", stop);
for (const child of children) {
  child.on("error", (error) => {
    console.error("Gagal menjalankan server:", error.message);
    stop();
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    if (stopping) return;
    console.error(
      `Server berhenti dengan kode ${code ?? "tidak diketahui"}; menghentikan semuanya.`,
    );
    stop();
    process.exitCode = code || 1;
  });
}
