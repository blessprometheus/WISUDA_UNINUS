import { createHash, createHmac } from "node:crypto";

import { config } from "../config.js";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Hash IP untuk log audit (HMAC berkunci; tidak menyimpan IP mentah). */
export function ipFingerprint(ip: string): string {
  return createHmac("sha256", config.auditSecret).update(`ip:${ip}`).digest("hex").slice(0, 16);
}
