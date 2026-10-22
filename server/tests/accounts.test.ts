import { Client, closeDatabase, createTestUser, resetDatabase } from "./helpers.js";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { buildApp } from "../src/app.js";
import { passwordProblem } from "../src/auth/password.js";
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

const LIST = [
  "email,nama,peran,divisi",
  "# komentar diabaikan",
  "ketua@uji.id,Ketua Panitia,ketua,",
  "acara@uji.id,Koordinator Acara,koordinator,Acara",
  "humas@uji.id,Koordinator Humas,koordinator,Humas",
  "scan1@uji.id,Petugas Scan 1,petugas,",
  "",
].join("\n");

describe("daftar akun (parser)", () => {
  it("menerima daftar yang benar dan mengabaikan judul, komentar, baris kosong", () => {
    const { specs, problems } = parseAccountList(LIST);
    assert.deepEqual(problems, []);
    assert.equal(specs.length, 4);
    assert.equal(specs[1]!.division, "Acara");
    assert.equal(specs[0]!.division, null);
  });

  it("menolak superadmin, peran asing, koordinator tanpa divisi, divisi untuk non-koordinator, email ganda", () => {
    const bad = [
      "a@uji.id,A,superadmin,",
      "b@uji.id,B,admin,",
      "c@uji.id,C,koordinator,",
      "d@uji.id,D,petugas,Acara",
      "e@uji.id,E,petugas,",
      "e@uji.id,E lagi,petugas,",
      "bukan-email,F,petugas,",
    ].join("\n");
    const { specs, problems } = parseAccountList(bad);
    assert.equal(specs.length, 1);
    assert.equal(problems.length, 6);
    assert.match(problems.join("\n"), /superadmin hanya dibuat lewat/);
    assert.match(problems.join("\n"), /email ganda/);
  });

  it("daftar kosong dianggap masalah", () => {
    assert.equal(parseAccountList("\n# saja\n").problems.length, 1);
  });
});

describe("pembuatan akun massal", () => {
  it("membuat akun dengan sandi acak yang memenuhi kebijakan, tersimpan sebagai hash, dan dapat dipakai login", async () => {
    const { specs } = parseAccountList(LIST);
    const results = await createAccounts(specs);
    assert.equal(results.length, 4);
    assert.ok(results.every((r) => r.status === "dibuat"));
    const passwords = results.map((r) => r.password!);
    assert.equal(new Set(passwords).size, 4, "sandi harus berbeda-beda");
    for (const password of passwords) assert.equal(passwordProblem(password), null);

    const stored = await pool.query("SELECT email, password_hash, role FROM users ORDER BY email");
    assert.equal(stored.rowCount, 4);
    for (const row of stored.rows) {
      assert.ok(row.password_hash.startsWith("scrypt$"));
      for (const password of passwords) assert.ok(!row.password_hash.includes(password));
    }

    const ketua = results.find((r) => r.email === "ketua@uji.id")!;
    const login = await new Client(app).request("POST", "/api/v1/auth/login", {
      email: ketua.email,
      password: ketua.password,
    });
    assert.equal(login.status, 200);
    assert.equal(login.json.data.user.role, "ketua");
  });

  it("koordinator terhubung ke divisinya, peran lain tidak punya divisi", async () => {
    const rows = await pool.query(
      `SELECT u.email, d.name AS division FROM users u
         LEFT JOIN user_divisions ud ON ud.user_id = u.id
         LEFT JOIN divisions d ON d.id = ud.division_id ORDER BY u.email`,
    );
    const byEmail = Object.fromEntries(rows.rows.map((r) => [r.email, r.division]));
    assert.equal(byEmail["acara@uji.id"], "Acara");
    assert.equal(byEmail["humas@uji.id"], "Humas");
    assert.equal(byEmail["ketua@uji.id"], null);
    assert.equal(byEmail["scan1@uji.id"], null);
  });

  it("menjalankan ulang melewati akun yang sudah ada tanpa mengubah sandinya", async () => {
    const before = await pool.query("SELECT email, password_hash FROM users ORDER BY email");
    const again = await createAccounts(parseAccountList(LIST).specs);
    assert.ok(again.every((r) => r.status === "sudah_ada" && r.password === undefined));
    const after = await pool.query("SELECT email, password_hash FROM users ORDER BY email");
    assert.deepEqual(after.rows, before.rows);
  });

  it("semua atau tidak sama sekali: kegagalan di tengah membatalkan seluruh daftar", async () => {
    const { specs } = parseAccountList(
      [
        "baru1@uji.id,Baru Satu,petugas,",
        `${"x".repeat(200)}@uji.id,Terlalu Panjang,petugas,`,
      ].join("\n"),
    );
    // Daftar kedua ditolak parser (email > 160); paksa kegagalan basis data dengan peran tak sah.
    const broken = [
      { email: "baru1@uji.id", name: "Baru Satu", role: "petugas" as const, division: null },
      { email: "baru2@uji.id", name: "Baru Dua", role: "bukan-peran" as never, division: null },
    ];
    assert.equal(specs.length, 1);
    await assert.rejects(createAccounts(broken));
    const left = await pool.query(
      "SELECT 1 FROM users WHERE email IN ('baru1@uji.id','baru2@uji.id')",
    );
    assert.equal(left.rowCount, 0);
  });

  it("peran lain tidak terpengaruh: akun yang ada tetap bisa dibuat dari dashboard oleh superadmin", async () => {
    await createTestUser("root@uji.id", "superadmin");
    const client = new Client(app);
    await client.request("POST", "/api/v1/auth/login", {
      email: "root@uji.id",
      password: "Sandi-Uji-12345",
    });
    assert.equal((await client.request("GET", "/api/v1/admin/users")).status, 200);
  });
});
