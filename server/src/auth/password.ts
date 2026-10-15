import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Parameter scrypt: N=2^15, r=8, p=1 (~32 MiB per hash). Tersimpan di hash, sehingga dapat dinaikkan kelak.
const COST = { N: 32_768, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const MAX_MEMORY = 128 * 1024 * 1024;

function deriveKey(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { ...options, maxmem: MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/** Format: scrypt$N$r$p$saltHex$keyHex */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, COST);
  return `scrypt$${COST.N}$${COST.r}$${COST.p}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, saltHex, keyHex] = stored.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !saltHex || !keyHex) return false;
  if (!/^[0-9a-f]+$/.test(saltHex) || !/^[0-9a-f]{128}$/.test(keyHex)) return false;
  const options = { N: Number(n), r: Number(r), p: Number(p) };
  if (![options.N, options.r, options.p].every((value) => Number.isInteger(value) && value > 0)) {
    return false;
  }
  const expected = Buffer.from(keyHex, "hex");
  const actual = await deriveKey(password, Buffer.from(saltHex, "hex"), options);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Kebijakan password: minimal 12 karakter, bukan hanya satu jenis karakter. */
export function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Kata sandi minimal 12 karakter.";
  if (password.length > 256) return "Kata sandi terlalu panjang.";
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password));
  if (kinds.length < 2) return "Kata sandi harus memadukan minimal dua jenis karakter.";
  return null;
}

/** Kata sandi sementara acak (memenuhi kebijakan). Ditampilkan sekali kepada superadmin. */
export function generatePassword(): string {
  return `${randomBytes(15).toString("base64url")}!9a`;
}
