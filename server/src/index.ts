import { buildApp } from "./app.js";
import { purgeExpiredSessions } from "./auth/session.js";
import { config } from "./config.js";
import { pool } from "./db.js";

const app = await buildApp();
await app.listen({ host: config.host, port: config.port });
console.log(`API Wisuda mendengarkan di http://${config.host}:${config.port}`);

const purgeTimer = setInterval(
  () => {
    purgeExpiredSessions().catch((error: unknown) => {
      console.error("Gagal membersihkan sesi kedaluwarsa:", (error as Error).message);
    });
  },
  60 * 60 * 1000,
);
purgeTimer.unref();

async function shutdown(): Promise<void> {
  clearInterval(purgeTimer);
  await app.close();
  await pool.end();
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
