import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";

import { config } from "./config.js";
import { pool } from "./db.js";
import { fail, ok } from "./http.js";
import { registerAttendanceRoutes } from "./routes/attendance.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerStudentRoutes } from "./routes/students.js";
import { registerTimelineRoutes } from "./routes/timeline.js";
import { registerUserRoutes } from "./routes/users.js";

export async function buildApp() {
  const app = Fastify({
    logger: false,
    bodyLimit: 200_000,
    trustProxy: config.trustProxy,
  });

  await app.register(cookie);
  await app.register(helmet);
  await app.register(rateLimit, { global: false });

  app.addHook("onRequest", async (request, reply) => {
    if (request.url.startsWith("/api/") || request.url.startsWith("/sanctum/")) {
      reply.header("Cache-Control", "private, no-store");
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    const apiError = error as { validation?: unknown; statusCode?: number; message?: string };
    if (apiError.validation) return fail(reply, 422, "Data yang dikirim tidak valid.");
    if (apiError.statusCode === 429) {
      return fail(reply, 429, "Terlalu banyak permintaan. Tunggu beberapa saat lalu coba lagi.");
    }
    if (apiError.statusCode === 413) return fail(reply, 413, "Permintaan terlalu besar.");
    if (apiError.statusCode && apiError.statusCode >= 400 && apiError.statusCode < 500) {
      return fail(reply, apiError.statusCode, "Permintaan tidak valid.");
    }
    console.error("Permintaan API gagal:", apiError.message ?? "unknown error");
    return fail(reply, 500, "Layanan sedang mengalami gangguan. Coba lagi nanti.");
  });

  app.get("/healthz", async (_request, reply) => {
    await pool.query("SELECT 1");
    return ok(reply, { status: "ok" });
  });

  await registerAuthRoutes(app);
  await registerStudentRoutes(app);
  await registerAttendanceRoutes(app);
  await registerReportRoutes(app);
  await registerUserRoutes(app);
  await registerTimelineRoutes(app);
  return app;
}
