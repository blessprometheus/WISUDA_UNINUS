import { Client, closeDatabase, createTestUser, resetDatabase } from "./helpers.js";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { buildApp } from "../src/app.js";
import { hashPassword, passwordProblem, verifyPassword } from "../src/auth/password.js";
import { pool } from "../src/db.js";

const PASSWORD = "Sandi-Uji-12345";

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

describe("password", () => {
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

  it("petugas langsung masuk, tetapi tidak bisa membuka /admin/users", async () => {
    await createTestUser("petugas@uji.id", "petugas");
    const client = new Client(app);
    const login = await client.request("POST", "/api/v1/auth/login", {
      email: "petugas@uji.id",
      password: PASSWORD,
    });
    assert.equal(login.status, 200);
    assert.equal(login.json.data.user.role, "petugas");
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

describe("superadmin tanpa 2FA (D40)", () => {
  it("superadmin langsung masuk dan dapat membuka /admin/users pada login pertama", async () => {
    await createTestUser("super@uji.id", "superadmin");
    const client = new Client(app);
    const login = await client.request("POST", "/api/v1/auth/login", {
      email: "super@uji.id",
      password: PASSWORD,
    });
    assert.equal(login.status, 200);
    assert.equal(login.json.data.user.role, "superadmin");
    assert.equal((await client.request("GET", "/api/v1/admin/users")).status, 200);
    assert.equal((await client.request("GET", "/api/v1/auth/me")).status, 200);
  });

  it("tanpa login atau dengan password salah tetap tidak bisa membuka /admin/users", async () => {
    assert.equal((await new Client(app).request("GET", "/api/v1/admin/users")).status, 401);
    const client = new Client(app);
    const wrong = await client.request("POST", "/api/v1/auth/login", {
      email: "super@uji.id",
      password: "Salah-Sandi-999",
    });
    assert.equal(wrong.status, 401);
    assert.equal((await client.request("GET", "/api/v1/admin/users")).status, 401);
  });

  it("respons tidak memuat sisa 2FA dan endpoint 2FA sudah tidak ada", async () => {
    const client = new Client(app);
    const login = await client.request("POST", "/api/v1/auth/login", {
      email: "super@uji.id",
      password: PASSWORD,
    });
    assert.equal("mfa" in login.json.data, false);
    for (const path of ["setup", "confirm", "verify"]) {
      assert.equal(
        (await client.request("POST", `/api/v1/auth/2fa/${path}`, {})).status,
        404,
        path,
      );
    }
    assert.equal((await client.request("POST", "/api/v1/admin/users/1/reset-2fa", {})).status, 404);
  });

  it("skema tidak lagi menyimpan rahasia 2FA", async () => {
    const columns = await pool.query(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND (column_name ILIKE '%totp%' OR column_name ILIKE '%mfa%')`,
    );
    assert.equal(columns.rowCount, 0);
    const tables = await pool.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recovery_codes'",
    );
    assert.equal(tables.rowCount, 0);
  });

  it("sesi lama dicabut saat login baru di klien yang sama (anti session-fixation)", async () => {
    const client = new Client(app);
    await client.request("POST", "/api/v1/auth/login", {
      email: "super@uji.id",
      password: PASSWORD,
    });
    const first = client.cookie("wisuda_session");
    await client.request("POST", "/api/v1/auth/login", {
      email: "super@uji.id",
      password: PASSWORD,
    });
    const second = client.cookie("wisuda_session");
    assert.ok(first && second);
    assert.notEqual(first, second);
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
