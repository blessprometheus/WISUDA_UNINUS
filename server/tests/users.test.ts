import {
  Client,
  closeDatabase,
  createTestUser,
  loginAs,
  resetDatabase,
  verifiedSuperadmin,
} from "./helpers.js";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { buildApp } from "../src/app.js";
import { pool } from "../src/db.js";

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;
let admin: Client;
let adminId = 0;

before(async () => {
  await resetDatabase();
  app = await buildApp();
  admin = await verifiedSuperadmin(app, "admin@uji.id");
  adminId = (await pool.query("SELECT id FROM users WHERE email = 'admin@uji.id'")).rows[0].id;
});

after(async () => {
  await app.close();
  await closeDatabase();
});

describe("akun pengguna", () => {
  it("superadmin membuat akun; kata sandi sementara tampil sekali dan dapat dipakai login", async () => {
    const created = await admin.request("POST", "/api/v1/admin/users", {
      name: "Petugas Baru",
      email: "Baru@Uji.id",
      role: "petugas",
    });
    assert.equal(created.status, 201);
    const password = created.json.data.temporary_password as string;
    assert.ok(password.length >= 12);
    assert.equal(created.json.data.email, "baru@uji.id");
    const stored = await pool.query("SELECT password_hash FROM users WHERE email = 'baru@uji.id'");
    assert.ok(!stored.rows[0].password_hash.includes(password), "tidak boleh tersimpan polos");

    const login = await new Client(app).request("POST", "/api/v1/auth/login", {
      email: "baru@uji.id",
      password,
    });
    assert.equal(login.status, 200);
    const listed = await admin.request("GET", "/api/v1/admin/users");
    assert.ok(
      !JSON.stringify(listed.json).includes(password),
      "daftar akun tidak boleh memuat kata sandi",
    );
  });

  it("email ganda → 409; masukan atau peran tidak sah → 422", async () => {
    const dup = await admin.request("POST", "/api/v1/admin/users", {
      name: "X",
      email: "baru@uji.id",
      role: "petugas",
    });
    assert.equal(dup.status, 409);
    for (const bad of [
      { name: "", email: "a@b.id", role: "petugas" },
      { name: "X", email: "bukan-email", role: "petugas" },
      { name: "X", email: "ok@uji.id", role: "dewa" },
    ]) {
      assert.equal(
        (await admin.request("POST", "/api/v1/admin/users", bad)).status,
        422,
        JSON.stringify(bad),
      );
    }
  });

  it("peran lain tidak dapat mengelola akun", async () => {
    await createTestUser("petugas@uji.id", "petugas");
    await createTestUser("ketua@uji.id", "ketua");
    for (const email of ["petugas@uji.id", "ketua@uji.id"]) {
      const client = await loginAs(app, email);
      assert.equal(
        (
          await client.request("POST", "/api/v1/admin/users", {
            name: "X",
            email: "x@uji.id",
            role: "petugas",
          })
        ).status,
        403,
      );
      assert.equal((await client.request("GET", "/api/v1/admin/audit-log")).status, 403);
      assert.equal(
        (await client.request("POST", `/api/v1/admin/users/${adminId}/deactivate`)).status,
        403,
      );
      assert.equal(
        (await client.request("POST", `/api/v1/admin/users/${adminId}/reset-password`)).status,
        403,
      );
    }
  });

  it("tidak dapat menonaktifkan diri sendiri walau ada superadmin lain; superadmin lain boleh dinonaktifkan", async () => {
    // Ada dua superadmin aktif: hanya pengaman "diri sendiri" yang bisa menolak permintaan ini.
    const otherId = await createTestUser("admin3@uji.id", "superadmin");
    assert.equal(
      (await admin.request("POST", `/api/v1/admin/users/${adminId}/deactivate`)).status,
      409,
    );
    assert.equal(
      (await pool.query("SELECT is_active FROM users WHERE id = $1", [adminId])).rows[0].is_active,
      true,
    );
    assert.equal(
      (await admin.request("POST", `/api/v1/admin/users/${otherId}/deactivate`)).status,
      200,
    );
    // Tinggal satu superadmin aktif; tetap ditolak.
    assert.equal(
      (await admin.request("POST", `/api/v1/admin/users/${adminId}/deactivate`)).status,
      409,
    );
    const active = await pool.query(
      "SELECT COUNT(*)::int AS n FROM users WHERE role = 'superadmin' AND is_active",
    );
    assert.equal(active.rows[0].n, 1);
  });

  it("nonaktifkan mencabut sesi dan menolak login; aktifkan kembali memulihkan", async () => {
    const created = await admin.request("POST", "/api/v1/admin/users", {
      name: "Sementara",
      email: "sem@uji.id",
      role: "petugas",
    });
    const id = created.json.data.id as number;
    const password = created.json.data.temporary_password as string;
    const client = new Client(app);
    await client.request("POST", "/api/v1/auth/login", { email: "sem@uji.id", password });
    assert.equal((await client.request("GET", "/api/v1/auth/me")).status, 200);
    assert.equal((await admin.request("POST", `/api/v1/admin/users/${id}/deactivate`)).status, 200);
    assert.equal((await client.request("GET", "/api/v1/auth/me")).status, 401);
    assert.equal(
      (
        await new Client(app).request("POST", "/api/v1/auth/login", {
          email: "sem@uji.id",
          password,
        })
      ).status,
      401,
    );
    assert.equal((await admin.request("POST", `/api/v1/admin/users/${id}/reactivate`)).status, 200);
    assert.equal(
      (
        await new Client(app).request("POST", "/api/v1/auth/login", {
          email: "sem@uji.id",
          password,
        })
      ).status,
      200,
    );
  });

  it("reset kata sandi: sandi lama mati, sesi dicabut, sandi baru berlaku", async () => {
    const created = await admin.request("POST", "/api/v1/admin/users", {
      name: "Reset",
      email: "reset@uji.id",
      role: "petugas",
    });
    const id = created.json.data.id as number;
    const oldPassword = created.json.data.temporary_password as string;
    const client = new Client(app);
    await client.request("POST", "/api/v1/auth/login", {
      email: "reset@uji.id",
      password: oldPassword,
    });
    const reset = await admin.request("POST", `/api/v1/admin/users/${id}/reset-password`);
    assert.equal(reset.status, 200);
    const newPassword = reset.json.data.temporary_password as string;
    assert.notEqual(newPassword, oldPassword);
    assert.equal((await client.request("GET", "/api/v1/auth/me")).status, 401);
    assert.equal(
      (
        await new Client(app).request("POST", "/api/v1/auth/login", {
          email: "reset@uji.id",
          password: oldPassword,
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await new Client(app).request("POST", "/api/v1/auth/login", {
          email: "reset@uji.id",
          password: newPassword,
        })
      ).status,
      200,
    );
  });

  it("cabut sesi dan reset 2FA", async () => {
    const created = await admin.request("POST", "/api/v1/admin/users", {
      name: "Dua",
      email: "dua@uji.id",
      role: "ketua",
    });
    const id = created.json.data.id as number;
    const client = new Client(app);
    await client.request("POST", "/api/v1/auth/login", {
      email: "dua@uji.id",
      password: created.json.data.temporary_password,
    });
    assert.equal(
      (await admin.request("POST", `/api/v1/admin/users/${id}/revoke-sessions`)).status,
      200,
    );
    assert.equal((await client.request("GET", "/api/v1/auth/me")).status, 401);

    await pool.query(
      "UPDATE users SET totp_enabled = TRUE, totp_secret_enc = 'v1.x.y.z' WHERE id = $1",
      [id],
    );
    await pool.query(
      "INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1, repeat('a', 64))",
      [id],
    );
    assert.equal((await admin.request("POST", `/api/v1/admin/users/${id}/reset-2fa`)).status, 200);
    const row = await pool.query("SELECT totp_enabled, totp_secret_enc FROM users WHERE id = $1", [
      id,
    ]);
    assert.equal(row.rows[0].totp_enabled, false);
    assert.equal(row.rows[0].totp_secret_enc, null);
    assert.equal(
      (await pool.query("SELECT 1 FROM recovery_codes WHERE user_id = $1", [id])).rowCount,
      0,
    );
    assert.equal((await admin.request("POST", "/api/v1/admin/users/999999/reset-2fa")).status, 404);
  });

  it("log audit mencatat tindakan dan dapat dibaca superadmin (berpaginasi)", async () => {
    const res = await admin.request("GET", "/api/v1/admin/audit-log?per_page=5");
    assert.equal(res.status, 200);
    assert.equal(res.json.data.length, 5);
    assert.ok(res.json.meta!.total > 5);
    const actions = (await pool.query("SELECT DISTINCT action FROM audit_log")).rows.map(
      (r) => r.action,
    );
    for (const expected of [
      "user_created",
      "user_deactivated",
      "user_reactivated",
      "user_password_reset",
      "user_sessions_revoked",
      "user_2fa_reset",
    ]) {
      assert.ok(actions.includes(expected), `audit harus memuat ${expected}`);
    }
    const detail = JSON.stringify((await pool.query("SELECT detail FROM audit_log")).rows);
    assert.ok(
      !/temporary_password|password_hash/i.test(detail),
      "audit tidak boleh memuat rahasia",
    );
  });

  it("tanpa CSRF atau tanpa login ditolak", async () => {
    assert.equal(
      (
        await admin.request(
          "POST",
          "/api/v1/admin/users",
          { name: "X", email: "x@uji.id", role: "petugas" },
          { csrf: false },
        )
      ).status,
      419,
    );
    assert.equal((await new Client(app).request("GET", "/api/v1/admin/users")).status, 401);
  });
});
