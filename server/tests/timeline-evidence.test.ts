import {
  Client,
  closeDatabase,
  createTestUser,
  loginAs,
  loginSuperadmin,
  resetDatabase,
} from "./helpers.js";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { buildApp } from "../src/app.js";
import { pool } from "../src/db.js";
import { detectEvidenceType, safeEvidenceName } from "../src/lib/evidence.js";

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;
let admin: Client;
let koorA: Client;
let koorB: Client;
let ketua: Client;
let petugas: Client;
let divA = 0;
let divB = 0;
let taskA = 0;
let taskB = 0;

/** Berkas uji minimal: tanda awal yang sah + isi tambahan. */
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("isi-png-uji-1234567890"),
]);
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from("isi-jpeg-uji-1234567"),
]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x20, 0, 0, 0]),
  Buffer.from("WEBP"),
  Buffer.from("isi-webp-uji"),
]);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const upload = (
  client: Client,
  taskId: number,
  data: Buffer,
  contentType = "image/png",
  filename = "bukti.png",
) =>
  client.request("POST", `/api/v1/timeline/tasks/${taskId}/evidence`, data, {
    contentType,
    headers: { "x-filename": encodeURIComponent(filename) },
  });

before(async () => {
  await resetDatabase();
  app = await buildApp();
  admin = await loginSuperadmin(app, "admin@uji.id");
  const idA = await createTestUser("koorA@uji.id", "koordinator");
  const idB = await createTestUser("koorB@uji.id", "koordinator");
  await createTestUser("ketua@uji.id", "ketua");
  await createTestUser("petugas@uji.id", "petugas");
  koorA = await loginAs(app, "koorA@uji.id");
  koorB = await loginAs(app, "koorB@uji.id");
  ketua = await loginAs(app, "ketua@uji.id");
  petugas = await loginAs(app, "petugas@uji.id");
  divA = (await admin.request("POST", "/api/v1/admin/divisions", { name: "Acara" })).json.data.id;
  divB = (await admin.request("POST", "/api/v1/admin/divisions", { name: "Konsumsi" })).json.data
    .id;
  await admin.request("POST", `/api/v1/admin/divisions/${divA}/members`, { user_id: idA });
  await admin.request("POST", `/api/v1/admin/divisions/${divB}/members`, { user_id: idB });
  taskA = (
    await koorA.request("POST", "/api/v1/timeline/tasks", {
      division_id: divA,
      title: "Susun rundown",
    })
  ).json.data.id;
  taskB = (
    await koorB.request("POST", "/api/v1/timeline/tasks", {
      division_id: divB,
      title: "Pesan konsumsi",
    })
  ).json.data.id;
});

after(async () => {
  await app.close();
  await closeDatabase();
});

describe("pekerjaan lengkap: tanggal mulai, tanggal selesai, deskripsi", () => {
  it("menyimpan dan mengembalikan semua kolom", async () => {
    const created = await koorA.request("POST", "/api/v1/timeline/tasks", {
      division_id: divA,
      title: "Sewa panggung",
      status: "berjalan",
      start_date: "2026-11-01",
      end_date: "2026-11-20",
      description: "  Hubungi 3 vendor, bandingkan harga.  ",
    });
    assert.equal(created.status, 201);
    const list = await koorA.request("GET", `/api/v1/timeline/tasks?division_id=${divA}`);
    const row = list.json.data.find((t: { title: string }) => t.title === "Sewa panggung");
    assert.equal(row.start_date, "2026-11-01");
    assert.equal(row.end_date, "2026-11-20");
    assert.equal(row.description, "Hubungi 3 vendor, bandingkan harga.");
    assert.equal(row.status, "berjalan");
    assert.equal(row.evidence_count, 0);

    const put = await koorA.request("PUT", `/api/v1/timeline/tasks/${created.json.data.id}`, {
      title: "Sewa panggung utama",
      status: "selesai",
      start_date: "2026-11-02",
      end_date: "2026-11-18",
      description: "",
    });
    assert.equal(put.status, 200);
    const after = (
      await koorA.request("GET", `/api/v1/timeline/tasks?division_id=${divA}`)
    ).json.data.find((t: { id: number }) => t.id === created.json.data.id);
    assert.equal(after.title, "Sewa panggung utama");
    assert.equal(after.start_date, "2026-11-02");
    assert.equal(after.description, null, "deskripsi kosong disimpan sebagai null");
  });

  it("menolak tanggal selesai sebelum tanggal mulai, tanggal tidak valid, dan deskripsi terlalu panjang", async () => {
    const post = (extra: Record<string, unknown>) =>
      koorA.request("POST", "/api/v1/timeline/tasks", { division_id: divA, title: "x", ...extra });
    const reversed = await post({ start_date: "2026-11-20", end_date: "2026-11-01" });
    assert.equal(reversed.status, 422);
    assert.match(String(reversed.json.message), /tidak boleh sebelum tanggal mulai/);
    assert.equal((await post({ start_date: "01/11/2026" })).status, 422);
    assert.equal((await post({ end_date: "2026-02-31x" })).status, 422);
    assert.equal((await post({ description: "x".repeat(2001) })).status, 422);
    assert.equal((await post({ description: 123 })).status, 422);
    assert.equal((await post({ start_date: "2026-11-01", end_date: "2026-11-01" })).status, 201);
    assert.equal(
      (await post({ start_date: "2026-11-01" })).status,
      201,
      "tanggal selesai opsional",
    );
  });

  it("keterlambatan dihitung dari tanggal selesai", async () => {
    const created = await koorA.request("POST", "/api/v1/timeline/tasks", {
      division_id: divA,
      title: "Lewat batas",
      start_date: "2020-01-01",
      end_date: "2020-02-01",
    });
    const row = (
      await koorA.request("GET", `/api/v1/timeline/tasks?division_id=${divA}`)
    ).json.data.find((t: { id: number }) => t.id === created.json.data.id);
    assert.equal(row.overdue, true);
  });
});

describe("bukti pekerjaan: pengenalan jenis dan nama berkas", () => {
  it("jenis ditentukan dari isi berkas", () => {
    assert.equal(detectEvidenceType(PNG)?.mime, "image/png");
    assert.equal(detectEvidenceType(JPEG)?.mime, "image/jpeg");
    assert.equal(detectEvidenceType(WEBP)?.mime, "image/webp");
    assert.equal(detectEvidenceType(PDF)?.mime, "application/pdf");
    assert.equal(detectEvidenceType(Buffer.from("MZ\x90\x00 program windows palsu")), null);
    assert.equal(detectEvidenceType(Buffer.from("<html><script>alert(1)</script></html>")), null);
    assert.equal(
      detectEvidenceType(Buffer.from("RIFF....WAVEdata....")),
      null,
      "RIFF selain WebP ditolak",
    );
    assert.equal(detectEvidenceType(Buffer.alloc(0)), null);
  });

  it("nama berkas dibersihkan: tanpa jalur/karakter berbahaya, ekstensi mengikuti isi", () => {
    const png = { mime: "image/png", ext: "png" } as const;
    assert.equal(safeEvidenceName(encodeURIComponent("../../etc/passwd"), png), "passwd.png");
    assert.equal(safeEvidenceName(encodeURIComponent("C:\\Users\\x\\foto.exe"), png), "foto.png");
    assert.equal(
      safeEvidenceName(encodeURIComponent("laporan akhir (final).pdf"), png),
      "laporan akhir (final).png",
    );
    assert.equal(safeEvidenceName(encodeURIComponent('a"b<script>.jpg'), png), "a_b_script_.png");
    assert.equal(safeEvidenceName(undefined, png), "bukti.png");
    assert.equal(
      safeEvidenceName("%E0%A4%A", png),
      "E0_A4_A.png",
      "persen tak valid tidak membuat galat",
    );
    assert.ok(safeEvidenceName("x".repeat(500), png).length <= 94);
    assert.equal(
      safeEvidenceName(encodeURIComponent("Dokumentasi Rapat Panitia.PNG"), png),
      "Dokumentasi Rapat Panitia.png",
    );
  });
});

describe("bukti pekerjaan: unggah, daftar, unduh, hapus", () => {
  let pngId = 0;

  it("koordinator mengunggah JPG, PNG, WebP, dan PDF pada divisinya; isi tersimpan utuh", async () => {
    const cases: Array<[Buffer, string, string, string]> = [
      [PNG, "image/png", "foto.png", "image/png"],
      [JPEG, "image/jpeg", "foto.jpg", "image/jpeg"],
      [WEBP, "image/webp", "foto.webp", "image/webp"],
      [PDF, "application/pdf", "laporan.pdf", "application/pdf"],
    ];
    for (const [data, contentType, name, mime] of cases) {
      const res = await upload(koorA, taskA, data, contentType, name);
      assert.equal(res.status, 201, name);
      assert.equal(res.json.data.mime, mime);
      assert.equal(res.json.data.size_bytes, data.length);
      if (name === "foto.png") pngId = res.json.data.id;
    }
    const list = await koorA.request("GET", `/api/v1/timeline/tasks/${taskA}/evidence`);
    assert.equal(list.status, 200);
    assert.equal(list.json.data.length, 4);
    assert.equal(list.json.data[0].uploaded_by, "Uji koordinator");
    assert.ok(!("data" in list.json.data[0]), "daftar tidak membawa isi berkas");

    const dl = await koorA.request("GET", `/api/v1/timeline/evidence/${pngId}`);
    assert.equal(dl.status, 200);
    assert.deepEqual(Buffer.from(dl.raw), PNG);
    const h = dl.headers;
    assert.equal(h["content-type"], "image/png");
    assert.match(String(h["content-disposition"]), /^inline; filename="foto\.png"/);
    assert.equal(h["x-content-type-options"], "nosniff");
    assert.match(String(h["content-security-policy"]), /sandbox/);
    assert.match(String(h["cache-control"]), /no-store/);
    const tasks = await koorA.request("GET", `/api/v1/timeline/tasks?division_id=${divA}`);
    assert.equal(tasks.json.data.find((t: { id: number }) => t.id === taskA).evidence_count, 4);
  });

  it("PDF diunduh sebagai lampiran, bukan dibuka di dalam situs", async () => {
    const list = await koorA.request("GET", `/api/v1/timeline/tasks/${taskA}/evidence`);
    const pdf = list.json.data.find((e: { mime: string }) => e.mime === "application/pdf");
    const dl = await koorA.request("GET", `/api/v1/timeline/evidence/${pdf.id}`);
    assert.match(String(dl.headers["content-disposition"]), /^attachment;/);
  });

  it("menolak: isi bukan JPG/PNG/WebP/PDF walau Content-Type dan nama menyamar, kosong, dan terlalu besar", async () => {
    const exe = Buffer.from("MZ\x90\x00" + "x".repeat(200));
    const disguised = await upload(koorA, taskA, exe, "image/png", "foto.png");
    assert.equal(disguised.status, 422);
    const html = await upload(
      koorA,
      taskA,
      Buffer.from("<script>alert(1)</script>"),
      "application/pdf",
      "a.pdf",
    );
    assert.equal(html.status, 422);
    assert.equal((await upload(koorA, taskA, Buffer.alloc(0))).status, 422);
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    assert.equal((await upload(koorA, taskA, big)).status, 413);
    const wrongType = await koorA.request(
      "POST",
      `/api/v1/timeline/tasks/${taskA}/evidence`,
      "{}",
      {
        contentType: "application/json",
      },
    );
    assert.ok(
      [415, 422, 400].includes(wrongType.status),
      `Content-Type JSON ditolak (${wrongType.status})`,
    );
    const count = await pool.query(
      "SELECT COUNT(*)::int AS n FROM task_evidence WHERE task_id = $1",
      [taskA],
    );
    assert.equal(count.rows[0].n, 4, "tidak ada berkas tertolak yang tersimpan");
  });

  it("maksimal 5 berkas per pekerjaan, dan batas itu tidak terlampaui oleh unggahan serentak", async () => {
    assert.equal((await upload(koorA, taskA, PNG)).status, 201);
    const extra = await upload(koorA, taskA, PNG);
    assert.equal(extra.status, 409);
    assert.match(String(extra.json.message), /Maksimal 5/);
    // unggahan serentak pada pekerjaan lain
    const fresh = (
      await koorA.request("POST", "/api/v1/timeline/tasks", {
        division_id: divA,
        title: "Serentak",
      })
    ).json.data.id;
    const results = await Promise.all(Array.from({ length: 8 }, () => upload(koorA, fresh, PNG)));
    assert.equal(results.filter((r) => r.status === 201).length, 5);
    assert.equal(results.filter((r) => r.status === 409).length, 3);
    const n = await pool.query("SELECT COUNT(*)::int AS n FROM task_evidence WHERE task_id = $1", [
      fresh,
    ]);
    assert.equal(n.rows[0].n, 5);
  });

  it("koordinator divisi lain tidak dapat mengunggah, melihat daftar, atau mengunduh; hanya melihat jumlahnya", async () => {
    assert.equal((await upload(koorB, taskA, PNG)).status, 403);
    assert.equal(
      (await koorB.request("GET", `/api/v1/timeline/tasks/${taskA}/evidence`)).status,
      403,
    );
    assert.equal((await koorB.request("GET", `/api/v1/timeline/evidence/${pngId}`)).status, 403);
    assert.equal(
      (await koorB.request("POST", `/api/v1/timeline/evidence/${pngId}/delete`)).status,
      403,
    );
    const tasks = await koorB.request("GET", `/api/v1/timeline/tasks?division_id=${divA}`);
    assert.equal(tasks.status, 200);
    const seen = tasks.json.data.find((t: { id: number }) => t.id === taskA);
    assert.equal(seen.evidence_count, 5);
    assert.ok(
      !JSON.stringify(tasks.json.data).includes("isi-png-uji"),
      "isi berkas tidak ada di daftar",
    );
    const stillThere = await pool.query("SELECT 1 FROM task_evidence WHERE id = $1", [pngId]);
    assert.equal(stillThere.rowCount, 1);
  });

  it("ketua dan superadmin dapat melihat dan mengunduh; ketua tidak dapat menulis atau menghapus; petugas ditolak", async () => {
    for (const client of [ketua, admin]) {
      assert.equal(
        (await client.request("GET", `/api/v1/timeline/tasks/${taskA}/evidence`)).status,
        200,
      );
      const dl = await client.request("GET", `/api/v1/timeline/evidence/${pngId}`);
      assert.equal(dl.status, 200);
      assert.deepEqual(Buffer.from(dl.raw), PNG);
    }
    assert.equal((await upload(ketua, taskA, PNG)).status, 403);
    assert.equal(
      (await ketua.request("POST", `/api/v1/timeline/evidence/${pngId}/delete`)).status,
      403,
    );
    for (const [m, u] of [
      ["GET", `/api/v1/timeline/tasks/${taskA}/evidence`],
      ["GET", `/api/v1/timeline/evidence/${pngId}`],
    ] as const) {
      assert.equal((await petugas.request(m, u)).status, 403, u);
    }
    assert.equal((await upload(petugas, taskA, PNG)).status, 403);
    assert.equal(
      (await new Client(app).request("GET", `/api/v1/timeline/evidence/${pngId}`)).status,
      401,
    );
  });

  it("unggah tanpa token CSRF ditolak", async () => {
    const res = await koorA.request("POST", `/api/v1/timeline/tasks/${taskB}/evidence`, PNG, {
      contentType: "image/png",
      csrf: false,
    });
    assert.ok([403, 419].includes(res.status), String(res.status));
    assert.equal(
      (await pool.query("SELECT 1 FROM task_evidence WHERE task_id = $1", [taskB])).rowCount,
      0,
    );
  });

  it("pekerjaan atau bukti yang tidak ada → 404", async () => {
    assert.equal((await upload(koorA, 999999, PNG)).status, 404);
    assert.equal(
      (await koorA.request("GET", "/api/v1/timeline/tasks/999999/evidence")).status,
      404,
    );
    assert.equal((await koorA.request("GET", "/api/v1/timeline/evidence/999999")).status, 404);
    assert.equal(
      (await koorA.request("POST", "/api/v1/timeline/evidence/999999/delete")).status,
      404,
    );
  });

  it("koordinator menghapus bukti divisinya; hapus pekerjaan oleh superadmin ikut menghapus semua bukti; semuanya diaudit", async () => {
    assert.equal(
      (await koorA.request("POST", `/api/v1/timeline/evidence/${pngId}/delete`)).status,
      200,
    );
    assert.equal((await koorA.request("GET", `/api/v1/timeline/evidence/${pngId}`)).status, 404);
    assert.equal(
      (await admin.request("POST", `/api/v1/timeline/tasks/${taskA}/delete`)).status,
      200,
    );
    const left = await pool.query(
      "SELECT COUNT(*)::int AS n FROM task_evidence WHERE task_id = $1",
      [taskA],
    );
    assert.equal(left.rows[0].n, 0);
    const actions = (await pool.query("SELECT DISTINCT action FROM audit_log")).rows.map(
      (r) => r.action,
    );
    for (const expected of ["task_evidence_added", "task_evidence_deleted"]) {
      assert.ok(actions.includes(expected), `audit harus memuat ${expected}`);
    }
    const detail = JSON.stringify(
      (await pool.query("SELECT detail FROM audit_log WHERE action LIKE 'task_evidence%'")).rows,
    );
    assert.ok(!detail.includes("isi-png-uji"), "audit tidak memuat isi berkas");
  });
});
