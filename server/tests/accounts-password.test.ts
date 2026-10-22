import { Client, closeDatabase, createTestUser, resetDatabase } from "./helpers.js";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { buildApp } from "../src/app.js";
import { passwordProblemFor } from "../src/auth/password.js";
import { config } from "../src/config.js";
import { pool } from "../src/db.js";
import { createAccounts, parseAccountList } from "../src/lib/bulk-accounts.js";

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

const login = (email: string, password: string) =>
  new Client(app).request("POST", "/api/v1/auth/login", { email, password });

describe("kebijakan sandi pada daftar akun (D43)", () => {
  it("bawaan: kebijakan aktif, sandi lemah ditolak", () => {
    assert.equal(config.enforcePasswordPolicy, true);
    const { specs, problems } = parseAccountList("scan1@uji.id,Scan 1,petugas,,scan1@530");
    assert.equal(specs.length, 0);
    assert.match(problems.join("\n"), /minimal 12 karakter/);
  });

  it("dilonggarkan: sandi pendek diterima, tetapi sandi kosong dan terlalu panjang tetap ditolak", () => {
    const ok = parseAccountList("scan1@uji.id,Scan 1,petugas,,scan1@530", {
      enforcePolicy: false,
    });
    assert.deepEqual(ok.problems, []);
    assert.equal(ok.specs[0]!.password, "scan1@530");
    assert.equal(passwordProblemFor("", false), "Kata sandi kosong.");
    assert.match(String(passwordProblemFor("x".repeat(257), false)), /terlalu panjang/);
    assert.equal(passwordProblemFor("pendek", true), "Kata sandi minimal 12 karakter.");
    assert.equal(passwordProblemFor("pendek", false), null);
  });

  it("kolom ke-6 atau lebih ditolak", () => {
    const { problems } = parseAccountList("a@uji.id,A,petugas,,sandi,lebih", {
      enforcePolicy: false,
    });
    assert.match(problems.join("\n"), /3-5 kolom/);
  });
});

describe("sandi pilihan sendiri", () => {
  const LIST = [
    "ketua@uji.id,Ketua,ketua,,ketua@530",
    "acara@uji.id,Koordinator Acara,koordinator,Acara,koracara@530",
    "scan1@uji.id,Petugas Scan 1,petugas,,scan1@530",
    "acak@uji.id,Tanpa Sandi,petugas,",
  ].join("\n");

  it("memakai sandi yang diberikan, tidak mengembalikannya, dan hanya akun tanpa sandi yang mendapat sandi acak", async () => {
    const { specs, problems } = parseAccountList(LIST, { enforcePolicy: false });
    assert.deepEqual(problems, []);
    const results = await createAccounts(specs);
    assert.ok(results.every((r) => r.status === "dibuat"));
    for (const r of results.filter((x) => x.email !== "acak@uji.id")) {
      assert.equal(r.password, undefined, "sandi pilihan sendiri tidak boleh dikembalikan");
    }
    assert.ok(results.find((r) => r.email === "acak@uji.id")!.password);

    assert.equal((await login("ketua@uji.id", "ketua@530")).status, 200);
    assert.equal((await login("scan1@uji.id", "scan1@530")).status, 200);
    assert.equal((await login("scan1@uji.id", "scan1@531")).status, 401);

    const hashes = await pool.query("SELECT password_hash FROM users");
    for (const row of hashes.rows) {
      assert.ok(row.password_hash.startsWith("scrypt$"));
      assert.ok(!row.password_hash.includes("scan1@530"));
    }
    const audit = JSON.stringify((await pool.query("SELECT detail FROM audit_log")).rows);
    assert.ok(!/scan1@530|ketua@530|koracara@530/.test(audit), "audit tidak boleh memuat sandi");
  });

  it("tanpa --update-passwords akun yang ada dilewati dan sandinya tidak berubah", async () => {
    const { specs } = parseAccountList("ketua@uji.id,Ketua,ketua,,sandi-baru-1", {
      enforcePolicy: false,
    });
    const results = await createAccounts(specs);
    assert.equal(results[0]!.status, "sudah_ada");
    assert.equal((await login("ketua@uji.id", "ketua@530")).status, 200);
    assert.equal((await login("ketua@uji.id", "sandi-baru-1")).status, 401);
  });

  it("dengan --update-passwords sandi diganti, sesi lama dicabut, kunci login dibuka", async () => {
    const old = new Client(app);
    await old.request("POST", "/api/v1/auth/login", {
      email: "ketua@uji.id",
      password: "ketua@530",
    });
    assert.equal((await old.request("GET", "/api/v1/auth/me")).status, 200);
    await pool.query(
      "UPDATE users SET failed_logins = 7, locked_until = NOW() + INTERVAL '1 hour' WHERE email = 'ketua@uji.id'",
    );

    const { specs } = parseAccountList("ketua@uji.id,Ketua,ketua,,sandi-baru-1", {
      enforcePolicy: false,
    });
    const results = await createAccounts(specs, { updatePasswords: true });
    assert.equal(results[0]!.status, "diperbarui");
    assert.equal(
      (await old.request("GET", "/api/v1/auth/me")).status,
      401,
      "sesi lama harus dicabut",
    );
    assert.equal((await login("ketua@uji.id", "ketua@530")).status, 401);
    assert.equal((await login("ketua@uji.id", "sandi-baru-1")).status, 200);
  });

  it("memperbarui akun dengan peran berbeda dibatalkan seluruhnya", async () => {
    await createTestUser("ganda@uji.id", "petugas");
    const { specs } = parseAccountList(
      ["baru@uji.id,Baru,petugas,,sandi-x", "ganda@uji.id,Ganda,ketua,,sandi-y"].join("\n"),
      { enforcePolicy: false },
    );
    await assert.rejects(createAccounts(specs, { updatePasswords: true }), /berbeda dari daftar/);
    assert.equal((await pool.query("SELECT 1 FROM users WHERE email = 'baru@uji.id'")).rowCount, 0);
  });
});
