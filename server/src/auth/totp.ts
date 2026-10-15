import { randomBytes } from "node:crypto";

import * as OTPAuth from "otpauth";

import { sha256Hex } from "./secrets.js";

const ISSUER = "Wisuda UNINUS";
const PERIOD = 30;

function totpFor(base32Secret: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
  });
}

export function newTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function otpauthUrl(base32Secret: string, label: string): string {
  return totpFor(base32Secret, label).toString();
}

/**
 * Verifikasi kode 6 digit dengan toleransi ±1 langkah. Mengembalikan nomor langkah waktu
 * yang cocok (untuk mencegah pemakaian ulang) atau null bila salah.
 */
export function verifyTotp(base32Secret: string, token: string, now = Date.now()): number | null {
  if (!/^[0-9]{6}$/.test(token)) return null;
  const delta = totpFor(base32Secret, "x").validate({ token, window: 1, timestamp: now });
  if (delta === null) return null;
  return Math.floor(now / 1000 / PERIOD) + delta;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 10 kode pemulihan berformat XXXXX-XXXXX (sekali pakai). */
export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(10);
    const chars = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
    return `${chars.slice(0, 5)}-${chars.slice(5)}`;
  });
}

export function normalizeRecoveryCode(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function recoveryCodeHash(code: string): string {
  return sha256Hex(`recovery:${normalizeRecoveryCode(code)}`);
}
