import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

import { config } from "../config.js";

/** Enkripsi AES-256-GCM untuk rahasia TOTP. Format: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config.totpKey, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), body]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, body] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("Format rahasia tidak dikenali.");
  const decipher = createDecipheriv("aes-256-gcm", config.totpKey, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Hash IP untuk log audit (HMAC berkunci; tidak menyimpan IP mentah). */
export function ipFingerprint(ip: string): string {
  return createHmac("sha256", config.auditSecret).update(`ip:${ip}`).digest("hex").slice(0, 16);
}
