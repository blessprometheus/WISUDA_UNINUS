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

// SEMUA data di bawah ini rekaan. Jangan pernah memakai data wisudawan asli dalam tes.
const HEADER = "NO,ANGKATAN,NIM,NAMA,PROGRAM STUDI,TANGGAL LULUS,,,";
const CSV_OK = [
  HEADER,
  ",2021,10000000001,Ani Rekaan,S1 Teknik Informatika,01 Oktober 2026,,,",
  ",2020,10000000002,Budi Rekaan,S1 Manajemen,01 Oktober 2026,,,",
  ",2022,10000000003,Cici Rekaan,S2 Ilmu Hukum,02 Oktober 2026,,,",
].join("\n");

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;
let admin: Client;

const importCsv = (client: Client, csv: string, dryRun = false) =>
  client.request("POST", `/api/v1/admin/students/import${dryRun ? "?dry_run=1" : ""}`, csv, {
    contentType: "text/csv",
    headers: { "x-filename": "uji.csv" },
  });

before(async () => {
  await resetDatabase();
  app = await buildApp();
  admin = await verifiedSuperadmin(app, "admin@uji.id");
  await createTestUser("petugas@uji.id", "petugas");
});

after(async () => {
  await app.close();
  await closeDatabase();
});

describe("impor CSV", () => {
  it("pratinjau (dry run) tidak menulis ke database", async () => {
    const res = await importCsv(admin, CSV_OK, true);
    assert.equal(res.status, 200);
    assert.equal(res.json.data.dry_run, true);
    assert.equal(res.json.data.valid_rows, 3);
    assert.equal(res.json.data.would_insert, 3);
    assert.equal(res.json.data.error_count, 0);
    const count = await pool.query("SELECT COUNT(*)::int AS n FROM students");
    assert.equal(count.rows[0].n, 0);
  });

  it("kolom kosong diabaikan; NIM ganda identik jadi peringatan, ganda berbeda ditolak semua", async () => {
    const csv = [
      HEADER,
      ",2021,10000000001,Ani Rekaan,S1 Teknik Informatika,01 Oktober 2026,,,",
      ",2021,10000000001,Ani Rekaan,S1 Teknik Informatika,01 Oktober 2026,,,",
      ",2020,10000000002,Budi Rekaan,S1 Manajemen,01 Oktober 2026,,,",
      ",2020,10000000002,Orang Lain,S1 Akuntansi,01 Oktober 2026,,,",
      ",2022,BAD NIM!,Dedi Rekaan,S1 Manajemen,,,,",
    ].join("\n");
    const res = await importCsv(admin, csv, true);
    const data = res.json.data;
    assert.equal(data.valid_rows, 1);
    assert.equal(data.warnings.length, 1);
    assert.match(
      data.errors.map((e: { message: string }) => e.message).join("|"),
      /ganda dengan data berbeda/,
    );
    assert.ok(data.errors.some((e: { column: string }) => e.column === "nim"));
  });

  it("menolak berkas tanpa kolom wajib dan bukan UTF-8", async () => {
    const noName = await importCsv(admin, "NIM,PROGRAM STUDI\n1,S1 X\n", true);
    assert.match(noName.json.data.errors[0].message, /Kolom wajib/);
    const bad = await admin.request(
      "POST",
      "/api/v1/admin/students/import",
      Buffer.from([0xff, 0xfe, 0x41]),
      {
        contentType: "text/csv",
      },
    );
    assert.equal(bad.status, 422);
  });

  it("mendukung BOM dan pemisah titik koma", async () => {
    const csv = "﻿NIM;NAMA;PROGRAM STUDI\n10000000009;Eka Rekaan;S1 Manajemen\n";
    const res = await importCsv(admin, csv, true);
    assert.equal(res.json.data.valid_rows, 1);
  });

  it("impor sungguhan menyimpan data, mencatat batch, dan mengaudit", async () => {
    const res = await importCsv(admin, CSV_OK);
    assert.equal(res.status, 200);
    assert.equal(res.json.data.inserted, 3);
    const rows = await pool.query(
      "SELECT nim, name, study_program, cohort_year, graduation_date_text FROM students ORDER BY nim",
    );
    assert.equal(rows.rowCount, 3);
    assert.equal(rows.rows[0].cohort_year, 2021);
    assert.equal(rows.rows[0].graduation_date_text, "01 Oktober 2026");
    assert.equal(
      (await pool.query("SELECT 1 FROM import_batches WHERE status = 'done'")).rowCount,
      1,
    );
    assert.equal(
      (await pool.query("SELECT 1 FROM audit_log WHERE action = 'students_import'")).rowCount,
      1,
    );
  });

  it("impor ulang idempoten: memperbarui data, token QR TIDAK berubah, tidak ada duplikat", async () => {
    const before = await pool.query("SELECT nim, attendance_token FROM students ORDER BY nim");
    const changed = CSV_OK.replace("Ani Rekaan", "Ani Rekaan Baru");
    const res = await importCsv(admin, changed);
    assert.equal(res.json.data.inserted, 0);
    assert.equal(res.json.data.updated, 3);
    const after = await pool.query("SELECT nim, name, attendance_token FROM students ORDER BY nim");
    assert.equal(after.rowCount, 3);
    assert.equal(after.rows[0].name, "Ani Rekaan Baru");
    assert.deepEqual(
      after.rows.map((r) => r.attendance_token),
      before.rows.map((r) => r.attendance_token),
    );
  });

  it("hanya superadmin yang boleh; tanpa CSRF ditolak; JSON ditolak", async () => {
    const petugas = await loginAs(app, "petugas@uji.id");
    assert.equal((await importCsv(petugas, CSV_OK)).status, 403);
    const noCsrf = await admin.request("POST", "/api/v1/admin/students/import", CSV_OK, {
      contentType: "text/csv",
      csrf: false,
    });
    assert.equal(noCsrf.status, 419);
    const json = await admin.request("POST", "/api/v1/admin/students/import", { a: 1 });
    assert.equal(json.status, 422);
    assert.equal((await new Client(app).request("GET", "/api/v1/admin/students")).status, 401);
  });
});

describe("pencarian NIM dan unduh QR", () => {
  it("NIM ditemukan → data minimal + tautan QR bertanda tangan; PNG valid", async () => {
    const client = new Client(app);
    const res = await client.request("POST", "/api/v1/lookup", { nim: "10000000002" });
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.json.data).sort(), ["name", "nim", "qr_url", "study_program"]);
    const png = await client.request("GET", res.json.data.qr_url as string);
    assert.equal(png.status, 200);
    assert.equal(png.headers["content-type"], "image/png");
    assert.equal(png.raw.subarray(0, 4).toString("hex"), "89504e47");
    assert.match(String(png.headers["content-disposition"]), /QR-WISUDA-70-10000000002\.png/);
  });

  it("NIM tak ada/format salah ditolak; tanda tangan diubah atau kedaluwarsa ditolak", async () => {
    const client = new Client(app);
    assert.equal(
      (await client.request("POST", "/api/v1/lookup", { nim: "99999999999" })).status,
      404,
    );
    assert.equal(
      (await client.request("POST", "/api/v1/lookup", { nim: "DROP TABLE;" })).status,
      422,
    );
    const ok = await client.request("POST", "/api/v1/lookup", { nim: "10000000001" });
    const url = new URL(ok.json.data.qr_url as string, "http://x");
    const sig = url.searchParams.get("signature")!;
    url.searchParams.set("signature", `${sig.slice(0, -1)}${sig.endsWith("0") ? "1" : "0"}`);
    assert.equal((await client.request("GET", url.pathname + url.search)).status, 403);
    const expired = new URL(ok.json.data.qr_url as string, "http://x");
    expired.searchParams.set("expires", String(Math.floor(Date.now() / 1000) - 10));
    assert.equal((await client.request("GET", expired.pathname + expired.search)).status, 403);
    // Tautan wisudawan lain dengan tanda tangan milik wisudawan ini harus gagal.
    const other = await pool.query("SELECT id FROM students WHERE nim = '10000000003'");
    const cross = new URL(ok.json.data.qr_url as string, "http://x");
    assert.equal(
      (await client.request("GET", `/api/v1/download/qr/${other.rows[0].id}${cross.search}`))
        .status,
      403,
    );
  });

  it("wisudawan nonaktif tidak dapat dicari", async () => {
    const id = (await pool.query("SELECT id FROM students WHERE nim = '10000000003'")).rows[0].id;
    assert.equal(
      (await admin.request("POST", `/api/v1/admin/students/${id}/deactivate`)).status,
      200,
    );
    assert.equal(
      (await new Client(app).request("POST", "/api/v1/lookup", { nim: "10000000003" })).status,
      404,
    );
    assert.equal(
      (await admin.request("POST", `/api/v1/admin/students/${id}/reactivate`)).status,
      200,
    );
    assert.equal(
      (await new Client(app).request("POST", "/api/v1/lookup", { nim: "10000000003" })).status,
      200,
    );
  });
});

describe("kelola wisudawan satu per satu", () => {
  it("tambah, ubah, NIM ganda → 409, dan tercatat di audit", async () => {
    const created = await admin.request("POST", "/api/v1/admin/students", {
      nim: "10000000050",
      name: "Fani Susulan",
      study_program: "S1 Manajemen",
      cohort_year: 2022,
    });
    assert.equal(created.status, 201);
    const dup = await admin.request("POST", "/api/v1/admin/students", {
      nim: "10000000050",
      name: "Lain",
      study_program: "S1 Manajemen",
    });
    assert.equal(dup.status, 409);
    const id = created.json.data.id as number;
    const edit = await admin.request("PUT", `/api/v1/admin/students/${id}`, {
      nim: "10000000050",
      name: "Fani Susulan Revisi",
      study_program: "S1 Manajemen",
    });
    assert.equal(edit.status, 200);
    const actions = await pool.query(
      "SELECT action FROM audit_log WHERE entity_id = $1 ORDER BY id",
      [id],
    );
    assert.deepEqual(
      actions.rows.map((r) => r.action),
      ["student_created", "student_updated"],
    );
    const list = await admin.request("GET", "/api/v1/admin/students?search=Susulan");
    assert.equal(list.json.data.length, 1);
  });

  it("masukan tidak valid ditolak", async () => {
    const res = await admin.request("POST", "/api/v1/admin/students", {
      nim: "",
      name: "x",
      study_program: "y",
    });
    assert.equal(res.status, 422);
  });
});
