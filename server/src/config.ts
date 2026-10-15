/** Konfigurasi dari environment. Aplikasi menolak start bila rahasia lemah atau tidak lengkap. */

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} wajib diatur.`);
  return value;
}

function requiredSecret(name: string): string {
  const value = required(name);
  if (value.length < 32 || value.startsWith("REPLACE_WITH_")) {
    throw new Error(`${name} wajib berisi nilai acak minimal 32 karakter.`);
  }
  return value;
}

function parseOrigin(): string {
  const url = new URL(required("APP_ORIGIN"));
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("APP_ORIGIN harus berupa URL HTTP(S).");
  }
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("APP_ORIGIN harus berupa origin domain tanpa path atau kredensial.");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("APP_ORIGIN produksi wajib memakai HTTPS.");
  }
  return url.origin;
}

function parsePort(): number {
  const port = Number(process.env.API_PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("API_PORT harus berupa nomor port 1-65535.");
  }
  return port;
}

/** Kunci AES-256 untuk rahasia TOTP: 32 byte dalam heksadesimal (64 karakter) atau base64. */
function parseEncryptionKey(): Buffer {
  const raw = required("TOTP_ENCRYPTION_KEY");
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TOTP_ENCRYPTION_KEY harus 32 byte (64 heks atau base64).");
  }
  return key;
}

const sessionSecret = requiredSecret("SESSION_SECRET");
const downloadSecret = requiredSecret("DOWNLOAD_SECRET");
const auditSecret = requiredSecret("AUDIT_SECRET");
if (new Set([sessionSecret, downloadSecret, auditSecret]).size !== 3) {
  throw new Error("SESSION_SECRET, DOWNLOAD_SECRET, dan AUDIT_SECRET harus berbeda.");
}

export const config = Object.freeze({
  host: process.env.API_HOST || "127.0.0.1",
  port: parsePort(),
  publicOrigin: parseOrigin(),
  databaseUrl: required("DATABASE_URL"),
  sessionSecret,
  downloadSecret,
  auditSecret,
  totpKey: parseEncryptionKey(),
  secureCookies: process.env.NODE_ENV === "production",
  trustProxy: process.env.TRUST_PROXY === "1",
  /** Batas login per menit per IP. Nilai lain hanya untuk tes. */
  loginRateMax: Number(process.env.LOGIN_RATE_MAX || 5),
});
