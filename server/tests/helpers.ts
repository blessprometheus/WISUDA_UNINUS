// PENTING: impor berkas ini PERTAMA di setiap tes (mengisi environment sebelum config dimuat).
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { FastifyInstance } from "fastify";

const testUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://wisuda_test@127.0.0.1:55433/wisuda_test";

// Pengaman: tes menghapus seluruh skema. Hanya boleh ke database tes lokal.
const parsed = new URL(testUrl);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || !parsed.pathname.includes("test")) {
  throw new Error("TEST_DATABASE_URL harus mengarah ke database lokal yang namanya memuat 'test'.");
}

process.env.DATABASE_URL = testUrl;
process.env.APP_ORIGIN = "http://127.0.0.1:3000";
process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = randomBytes(24).toString("hex");
process.env.DOWNLOAD_SECRET = randomBytes(24).toString("hex");
process.env.AUDIT_SECRET = randomBytes(24).toString("hex");
process.env.TOTP_ENCRYPTION_KEY = randomBytes(32).toString("hex");
process.env.LOGIN_RATE_MAX = process.env.LOGIN_RATE_MAX ?? "1000";

export const ORIGIN = process.env.APP_ORIGIN;
const sqlDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../sql");

export async function resetDatabase(): Promise<void> {
  const { pool } = await import("../src/db.js");
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  const files = (await readdir(sqlDir)).filter((name) => /^\d{3}_.+\.sql$/.test(name)).sort();
  for (const file of files) {
    await pool.query(await readFile(path.join(sqlDir, file), "utf8"));
  }
}

export async function createTestUser(
  email: string,
  role: "superadmin" | "petugas" | "koordinator" | "ketua",
  password = "Sandi-Uji-12345",
): Promise<number> {
  const { pool } = await import("../src/db.js");
  const { hashPassword } = await import("../src/auth/password.js");
  const result = await pool.query<{ id: number }>(
    "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id",
    [`Uji ${role}`, email, await hashPassword(password), role],
  );
  return result.rows[0]!.id;
}

export async function closeDatabase(): Promise<void> {
  const { pool } = await import("../src/db.js");
  await pool.end();
}

/** Bentuk respons API dalam tes. `data` sengaja dinamis: tiap endpoint punya bentuk sendiri. */
export interface ApiBody {
  success?: boolean;
  message?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

/** Klien uji dengan penampung cookie, CSRF, dan header Origin. */
export class Client {
  private jar = new Map<string, string>();

  constructor(private readonly app: FastifyInstance) {}

  cookie(name: string): string | undefined {
    return this.jar.get(name);
  }

  private store(cookies: readonly { name: string; value: string; maxAge?: number }[]): void {
    for (const cookie of cookies) {
      if (cookie.value === "" || cookie.maxAge === 0) this.jar.delete(cookie.name);
      else this.jar.set(cookie.name, cookie.value);
    }
  }

  async request(
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    body?: unknown,
    options: { csrf?: boolean; origin?: string } = {},
  ) {
    if (method !== "GET" && !this.jar.has("XSRF-TOKEN")) {
      this.store((await this.app.inject({ method: "GET", url: "/sanctum/csrf-cookie" })).cookies);
    }
    const headers: Record<string, string> = {
      cookie: [...this.jar].map(([key, value]) => `${key}=${value}`).join("; "),
    };
    if (method !== "GET") {
      headers.origin = options.origin ?? ORIGIN;
      if (options.csrf !== false) headers["x-xsrf-token"] = this.jar.get("XSRF-TOKEN") ?? "";
    }
    const response = await this.app.inject({
      method,
      url,
      headers,
      ...(body === undefined ? {} : { payload: body as object }),
    });
    this.store(response.cookies);
    return {
      status: response.statusCode,
      json: (response.body ? JSON.parse(response.body) : {}) as ApiBody,
    };
  }
}
