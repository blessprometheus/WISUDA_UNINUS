import { Client, closeDatabase, createTestUser, resetDatabase, totpCode } from "./helpers.js";
import "./no2fa-env.js";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { buildApp } from "../src/app.js";
import { config } from "../src/config.js";

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;
const PASSWORD = "Sandi-Uji-12345";

before(async () => {
  await resetDatabase();
  app = await buildApp();
});

after(async () => {
  await app.close();
  await closeDatabase();
});

describe("2FA superadmin dinonaktifkan lewat REQUIRE_SUPERADMIN_2FA=0", () => {
  it("pengaturan terbaca", () => {
    assert.equal(config.require2faForSuperadmin, false);
  });

  it("superadmin tanpa 2FA langsung terverifikasi dan dapat membuka /admin", async () => {
    await createTestUser("super@uji.id", "superadmin");
    const client = new Client(app);
    const login = await client.request("POST", "/api/v1/auth/login", {
      email: "super@uji.id",
      password: PASSWORD,
    });
    assert.equal(login.status, 200);
    assert.equal(login.json.data.mfa.verified, true);
    assert.equal(login.json.data.mfa.setup_required, false);
    assert.equal((await client.request("GET", "/api/v1/admin/users")).status, 200);
    assert.equal(
      (await client.request("GET", "/api/v1/auth/me")).json.data.mfa.setup_required,
      false,
    );
  });

  it("jika superadmin MEMILIH mengaktifkan 2FA, kode tetap wajib pada login berikutnya", async () => {
    const client = new Client(app);
    await client.request("POST", "/api/v1/auth/login", {
      email: "super@uji.id",
      password: PASSWORD,
    });
    const setup = await client.request("POST", "/api/v1/auth/2fa/setup");
    assert.equal(setup.status, 200);
    const confirm = await client.request("POST", "/api/v1/auth/2fa/confirm", {
      code: totpCode(setup.json.data.secret),
    });
    assert.equal(confirm.status, 200);

    const again = new Client(app);
    const login = await again.request("POST", "/api/v1/auth/login", {
      email: "super@uji.id",
      password: PASSWORD,
    });
    assert.equal(login.json.data.mfa.verified, false);
    assert.equal((await again.request("GET", "/api/v1/admin/users")).status, 403);
    const verified = await again.request("POST", "/api/v1/auth/2fa/verify", {
      code: totpCode(setup.json.data.secret, 1),
    });
    assert.equal(verified.status, 200);
    assert.equal((await again.request("GET", "/api/v1/admin/users")).status, 200);
  });

  it("peran lain tidak terpengaruh: petugas tetap tanpa akses admin", async () => {
    await createTestUser("petugas@uji.id", "petugas");
    const client = new Client(app);
    await client.request("POST", "/api/v1/auth/login", {
      email: "petugas@uji.id",
      password: PASSWORD,
    });
    assert.equal((await client.request("GET", "/api/v1/admin/users")).status, 403);
  });
});
