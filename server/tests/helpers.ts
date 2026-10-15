// PENTING: impor berkas ini PERTAMA di setiap tes (mengisi environment sebelum config dimuat).
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { FastifyInstance } from "fastify";
import * as OTPAuth from "otpauth";

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

/** Kode TOTP untuk langkah waktu `offsetSteps` dari sekarang. */
export function totpCode(base32: string, offsetSteps = 0): string {
  const totp = new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32),
  });
  return totp.generate({ timestamp: Date.now() + offsetSteps * 30_000 });
}

export const TEST_PASSWORD = "Sandi-Uji-12345";

/** Login sebagai peran non-superadmin (tanpa 2FA). */
export async function loginAs(app: FastifyInstance, email: string): Promise<Client> {
  const client = new Client(app);
  const res = await client.request("POST", "/api/v1/auth/login", {
    email,
    password: TEST_PASSWORD,
  });
  if (res.status !== 200) throw new Error(`Login uji gagal untuk ${email}: ${res.status}`);
  return client;
}

/** Buat superadmin, selesaikan wajib-2FA, dan kembalikan klien yang sudah terverifikasi penuh. */
export async function verifiedSuperadmin(app: FastifyInstance, email: string): Promise<Client> {
  await createTestUser(email, "superadmin");
  const client = await loginAs(app, email);
  const setup = await client.request("POST", "/api/v1/auth/2fa/setup");
  const confirm = await client.request("POST", "/api/v1/auth/2fa/confirm", {
    code: totpCode(setup.json.data.secret as string),
  });
  if (confirm.status !== 200) throw new Error("Pendaftaran 2FA uji gagal.");
  return client;
}

export async function closeDatabase(): Promise<void> {
  const { pool } = await import("../src/db.js");
  await pool.end();
}

/** Bentuk respons API dalam tes. `data` sengaja dinamis: tiap endpoint punya bentuk sendiri. */
export interface ApiBody {
  success?: boolean;
  message?: string;
  meta?: { page: number; per_page: number; total: number; last_page: number };
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
    options: {
      csrf?: boolean;
      origin?: string;
      contentType?: string;
      headers?: Record<string, string>;
    } = {},
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
    if (options.contentType) headers["content-type"] = options.contentType;
    Object.assign(headers, options.headers);
    const response = await this.app.inject({
      method,
      url,
      headers,
      ...(body === undefined ? {} : { payload: body as object | string }),
    });
    this.store(response.cookies);
    const isJson = String(response.headers["content-type"] ?? "").includes("application/json");
    return {
      status: response.statusCode,
      headers: response.headers,
      raw: response.rawPayload,
      text: response.body,
      json: (isJson && response.body ? JSON.parse(response.body) : {}) as ApiBody,
    };
  }
}
