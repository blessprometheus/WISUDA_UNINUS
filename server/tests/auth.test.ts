import { Client, closeDatabase, createTestUser, resetDatabase } from "./helpers.js";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import * as OTPAuth from "otpauth";

import { buildApp } from "../src/app.js";
import { hashPassword, passwordProblem, verifyPassword } from "../src/auth/password.js";
import { decryptSecret, encryptSecret } from "../src/auth/secrets.js";
import { pool } from "../src/db.js";

const PASSWORD = "Sandi-Uji-12345";

/** Kode TOTP untuk langkah waktu `offsetSteps` dari sekarang. */
function totpCode(base32: string, offsetSteps = 0): string {
  const totp = new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32),
  });
  return totp.generate({ timestamp: Date.now() + offsetSteps * 30_000 });
}

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;

before(async () => {
  await resetDatabase();
  app = await buildApp();
});

after(async () => {
  await app.close();
  await closeDatabase();
});

describe("password & rahasia", () => {
  it("hash dapat diverifikasi dan password salah ditolak", async () => {
    const hash = await hashPassword(PASSWORD);
    assert.ok(hash.startsWith("scrypt$"));
    assert.equal(await verifyPassword(PASSWORD, hash), true);
    assert.equal(await verifyPassword("salah", hash), false);
    assert.equal(await verifyPassword(PASSWORD, "bukan-hash"), false);
  });

  it("kebijakan password menolak yang lemah", () => {
    assert.ok(passwordProblem("pendek1A"));
    assert.ok(passwordProblem("aaaaaaaaaaaaaaaa"));
    assert.equal(passwordProblem("Cukup-Panjang-1"), null);
  });

  it("enkripsi rahasia dua arah dan menolak data yang diubah", () => {
    const cipher = encryptSecret("JBSWY3DPEHPK3PXP");
    assert.equal(decryptSecret(cipher), "JBSWY3DPEHPK3PXP");
    const [v, iv, tag, body] = cipher.split(".");
    const tampered = [v, iv, tag, `${body!.slice(0, -2)}AA`].join(".");
    assert.throws(() => decryptSecret(tampered));
  });
});

describe("login dasar", () => {
  it("/me tanpa sesi → 401", async () => {
    const res = await new Client(app).request("GET", "/api/v1/auth/me");
    assert.equal(res.status, 401);
  });

  it("login tanpa token CSRF → 419", async () => {
    await createTestUser("csrf@uji.id", "petugas");
    const res = await new Client(app).request(
      "POST",
      "/api/v1/auth/login",
      { email: "csrf@uji.id", password: PASSWORD },
      { csrf: false },
    );
    assert.equal(res.status, 419);
  });

  it("login dari Origin lain → 403", async () => {
    const res = await new Client(app).request(
      "POST",
      "/api/v1/auth/login",
      { email: "csrf@uji.id", password: PASSWORD },
      { origin: "https://jahat.example" },
    );
    assert.equal(res.status, 403);
  });

  it("email tak dikenal dan password salah memberi pesan yang sama", async () => {
    await createTestUser("salah@uji.id", "petugas");
    const client = new Client(app);
    const unknown = await client.request("POST", "/api/v1/auth/login", {
      email: "tidak-ada@uji.id",
      password: PASSWORD,
    });
    const wrong = await client.request("POST", "/api/v1/auth/login", {
      email: "salah@uji.id",
      password: "Salah-Sandi-999",
    });
    assert.equal(unknown.status, 401);
    assert.equal(wrong.status, 401);
    assert.equal(unknown.json.message, wrong.json.message);
  });

  it("petugas tanpa 2FA langsung terverifikasi, tetapi tidak bisa membuka /admin/users", async () => {
    await createTestUser("petugas@uji.id", "petugas");
    const client = new Client(app);
    const login = await client.request("POST", "/api/v1/auth/login", {
      email: "petugas@uji.id",
      password: PASSWORD,
    });
    assert.equal(login.status, 200);
    assert.equal(login.json.data.mfa.verified, true);
    assert.equal((await client.request("GET", "/api/v1/auth/me")).status, 200);
    assert.equal((await client.request("GET", "/api/v1/admin/users")).status, 403);
  });

  it("koordinator dan ketua juga ditolak dari /admin/users", async () => {
    for (const role of ["koordinator", "ketua"] as const) {
      await createTestUser(`${role}@uji.id`, role);
      const client = new Client(app);
      await client.request("POST", "/api/v1/auth/login", {
        email: `${role}@uji.id`,
        password: PASSWORD,
      });
      assert.equal((await client.request("GET", "/api/v1/admin/users")).status, 403, role);
    }
  });

  it("logout mencabut sesi", async () => {
    await createTestUser("keluar@uji.id", "petugas");
    const client = new Client(app);
    await client.request("POST", "/api/v1/auth/login", {
      email: "keluar@uji.id",
      password: PASSWORD,
    });
    const token = client.cookie("wisuda_session");
    assert.ok(token);
    assert.equal((await client.request("POST", "/api/v1/auth/logout")).status, 200);
    assert.equal((await client.request("GET", "/api/v1/auth/me")).status, 401);
    const left = await pool.query(
      "SELECT 1 FROM user_sessions WHERE user_id = (SELECT id FROM users WHERE email = 'keluar@uji.id')",
    );
    assert.equal(left.rowCount, 0);
  });

  it("akun nonaktif tidak bisa login", async () => {
    const id = await createTestUser("mati@uji.id", "petugas");
    await pool.query("UPDATE users SET is_active = FALSE WHERE id = $1", [id]);
    const res = await new Client(app).request("POST", "/api/v1/auth/login", {
      email: "mati@uji.id",
      password: PASSWORD,
    });
    assert.equal(res.status, 401);
  });
});

describe("penguncian akun", () => {
  it("5 kegagalan mengunci akun walau password berikutnya benar", async () => {
    await createTestUser("kunci@uji.id", "petugas");
    const client = new Client(app);
    for (let i = 0; i < 5; i += 1) {
      const res = await client.request("POST", "/api/v1/auth/login", {
        email: "kunci@uji.id",
        password: "Salah-Sandi-999",
      });
      assert.equal(res.status, 401);
    }
    const locked = await client.request("POST", "/api/v1/auth/login", {
      email: "kunci@uji.id",
      password: PASSWORD,
    });
    assert.equal(locked.status, 429);
    // Buka kunci secara paksa: login benar kembali berhasil dan penghitung direset.
    await pool.query(
      "UPDATE users SET locked_until = NOW() - INTERVAL '1 second' WHERE email = 'kunci@uji.id'",
    );
    const ok = await client.request("POST", "/api/v1/auth/login", {
      email: "kunci@uji.id",
      password: PASSWORD,
    });
    assert.equal(ok.status, 200);
    const row = await pool.query("SELECT failed_logins FROM users WHERE email = 'kunci@uji.id'");
    assert.equal(row.rows[0].failed_logins, 0);
  });
});

describe("2FA superadmin", () => {
  let secret = "";
  let recovery: string[] = [];

  it("login pertama superadmin: wajib setup 2FA, belum bisa mengakses apa pun", async () => {
    await createTestUser("super@uji.id", "superadmin");
    const client = new Client(app);
    const login = await client.request("POST", "/api/v1/auth/login", {
      email: "super@uji.id",
      password: PASSWORD,
    });
    assert.equal(login.status, 200);
    assert.equal(login.json.data.mfa.verified, false);
    assert.equal(login.json.data.mfa.setup_required, true);
    assert.equal((await client.request("GET", "/api/v1/admin/users")).status, 403);

    const setup = await client.request("POST", "/api/v1/auth/2fa/setup");
    assert.equal(setup.status, 200);
    secret = setup.json.data.secret as string;
    assert.match(setup.json.data.qr_data_url, /^data:image\/png;base64,/);

    const bad = await client.request("POST", "/api/v1/auth/2fa/confirm", { code: "000000" });
    assert.equal(bad.status, 401);

    const confirm = await client.request("POST", "/api/v1/auth/2fa/confirm", {
      code: totpCode(secret),
    });
    assert.equal(confirm.status, 200);
    recovery = confirm.json.data.recovery_codes as string[];
    assert.equal(recovery.length, 10);
    assert.equal((await client.request("GET", "/api/v1/admin/users")).status, 200);
  });

  it("rahasia 2FA tersimpan terenkripsi, bukan polos", async () => {
    const row = await pool.query("SELECT totp_secret_enc FROM users WHERE email = 'super@uji.id'");
    assert.ok(row.rows[0].totp_secret_enc.startsWith("v1."));
    assert.ok(!row.rows[0].totp_secret_enc.includes(secret));
  });

  it("login berikutnya meminta kode; kode yang sama tidak bisa dipakai ulang", async () => {
    const client = new Client(app);
    const login = await client.request("POST", "/api/v1/auth/login", {
      email: "super@uji.id",
      password: PASSWORD,
    });
    assert.equal(login.json.data.mfa.verified, false);
    assert.equal(login.json.data.mfa.enabled, true);
    assert.equal((await client.request("GET", "/api/v1/admin/users")).status, 403);

    const wrong = await client.request("POST", "/api/v1/auth/2fa/verify", { code: "123456" });
    assert.equal(wrong.status, 401);

    // Langkah berikutnya (+1) sah karena toleransi ±1; langkah konfirmasi (0) sudah terpakai.
    const next = totpCode(secret, 1);
    const good = await client.request("POST", "/api/v1/auth/2fa/verify", { code: next });
    assert.equal(good.status, 200);
    assert.equal((await client.request("GET", "/api/v1/admin/users")).status, 200);

    const second = new Client(app);
    await second.request("POST", "/api/v1/auth/login", {
      email: "super@uji.id",
      password: PASSWORD,
    });
    const replay = await second.request("POST", "/api/v1/auth/2fa/verify", { code: next });
    assert.equal(replay.status, 401);
  });

  it("sesi yang belum lolos 2FA tidak bisa mengganti rahasia 2FA", async () => {
    const client = new Client(app);
    await client.request("POST", "/api/v1/auth/login", {
      email: "super@uji.id",
      password: PASSWORD,
    });
    const before = await pool.query(
      "SELECT totp_secret_enc FROM users WHERE email = 'super@uji.id'",
    );
    const setup = await client.request("POST", "/api/v1/auth/2fa/setup");
    assert.equal(setup.status, 409);
    const after = await pool.query(
      "SELECT totp_secret_enc FROM users WHERE email = 'super@uji.id'",
    );
    assert.equal(after.rows[0].totp_secret_enc, before.rows[0].totp_secret_enc);
  });

  it("kode pemulihan bekerja sekali saja", async () => {
    const code = recovery[0]!;
    const first = new Client(app);
    await first.request("POST", "/api/v1/auth/login", {
      email: "super@uji.id",
      password: PASSWORD,
    });
    const used = await first.request("POST", "/api/v1/auth/2fa/verify", { code });
    assert.equal(used.status, 200);

    const second = new Client(app);
    await second.request("POST", "/api/v1/auth/login", {
      email: "super@uji.id",
      password: PASSWORD,
    });
    const again = await second.request("POST", "/api/v1/auth/2fa/verify", { code });
    assert.equal(again.status, 401);
  });

  it("sesi diganti baru setelah lolos 2FA (anti session-fixation)", async () => {
    const client = new Client(app);
    await client.request("POST", "/api/v1/auth/login", {
      email: "super@uji.id",
      password: PASSWORD,
    });
    const pending = client.cookie("wisuda_session");
    await client.request("POST", "/api/v1/auth/2fa/verify", { code: recovery[1]! });
    assert.notEqual(client.cookie("wisuda_session"), pending);
  });
});

describe("audit", () => {
  it("login berhasil dan gagal tercatat tanpa menyimpan IP mentah", async () => {
    const rows = await pool.query(
      "SELECT action, ip_hash FROM audit_log WHERE action IN ('login_ok','login_failed')",
    );
    assert.ok(rows.rows.length > 0);
    for (const row of rows.rows) {
      assert.match(row.ip_hash, /^[0-9a-f]{16}$/);
    }
  });
});
