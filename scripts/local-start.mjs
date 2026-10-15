// Menjalankan API (3001) dan situs (3000) bersamaan untuk uji LOKAL. Hentikan keduanya dengan Ctrl+C.
// Prasyarat: .env.local terisi, `npm run build` sudah dijalankan dengan saklar fitur, dan database lokal hidup.
import { spawn } from "node:child_process";

const children = [
  spawn(process.execPath, ["--env-file-if-exists=.env.local", "--import", "tsx", "server/src/index.ts"], {
    stdio: "inherit",
  }),
  spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3000"], { stdio: "inherit" }),
];

function stop() {
  for (const child of children) child.kill();
}
process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", stop);
for (const child of children) {
  child.on("exit", (code) => {
    if (code) {
      console.error(`Proses berhenti dengan kode ${code}; menghentikan semuanya.`);
      stop();
      process.exitCode = code;
    }
  });
}
