import {
  Client,
  closeDatabase,
  createTestUser,
  loginAs,
  resetDatabase,
  loginSuperadmin,
} from "./helpers.js";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { buildApp } from "../src/app.js";
import { pool } from "../src/db.js";

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

const dayOffset = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
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
  assert.equal(
    (await admin.request("POST", `/api/v1/admin/divisions/${divA}/members`, { user_id: idA }))
      .status,
    200,
  );
  assert.equal(
    (await admin.request("POST", `/api/v1/admin/divisions/${divB}/members`, { user_id: idB }))
      .status,
    200,
  );
  taskA = (
    await koorA.request("POST", "/api/v1/timeline/tasks", {
      division_id: divA,
      title: "Susun rundown",
      due_date: dayOffset(-2),
    })
  ).json.data.id;
  taskB = (
    await koorB.request("POST", "/api/v1/timeline/tasks", {
      division_id: divB,
      title: "Pesan konsumsi",
      status: "berjalan",
      due_date: dayOffset(5),
    })
  ).json.data.id;
});

after(async () => {
  await app.close();
  await closeDatabase();
});

describe("divisi dan penugasan", () => {
  it("hanya superadmin yang membuat divisi dan menugaskan; hanya peran koordinator yang dapat ditugaskan", async () => {
    for (const client of [koorA, ketua, petugas]) {
      assert.equal(
        (await client.request("POST", "/api/v1/admin/divisions", { name: "Liar" })).status,
        403,
      );
      assert.equal((await client.request("GET", "/api/v1/admin/divisions")).status, 403);
    }
    assert.equal(
      (await admin.request("POST", "/api/v1/admin/divisions", { name: "Acara" })).status,
      409,
    );
    assert.equal(
      (await admin.request("POST", "/api/v1/admin/divisions", { name: "" })).status,
      422,
    );
    const ketuaId = (await pool.query("SELECT id FROM users WHERE email = 'ketua@uji.id'")).rows[0]
      .id;
    assert.equal(
      (await admin.request("POST", `/api/v1/admin/divisions/${divA}/members`, { user_id: ketuaId }))
        .status,
      409,
    );
  });

  it("satu divisi boleh punya beberapa koordinator", async () => {
    const idB = (await pool.query("SELECT id FROM users WHERE email = 'koorB@uji.id'")).rows[0].id;
    assert.equal(
      (await admin.request("POST", `/api/v1/admin/divisions/${divA}/members`, { user_id: idB }))
        .status,
      200,
    );
    const list = await admin.request("GET", "/api/v1/admin/divisions");
    const acara = list.json.data.find((d: { name: string }) => d.name === "Acara");
    assert.equal(acara.members.length, 2);
    assert.equal(
      (await admin.request("POST", `/api/v1/admin/divisions/${divA}/members/${idB}/remove`)).status,
      200,
    );
  });

  it("semua peran pembaca melihat semua divisi; `mine` menandai divisi yang boleh diubah (D46)", async () => {
    const asA = await koorA.request("GET", "/api/v1/timeline/divisions");
    assert.deepEqual(
      asA.json.data.map((d: { name: string; mine: boolean }) => [d.name, d.mine]),
      [
        ["Acara", true],
        ["Konsumsi", false],
      ],
    );
    const asB = await koorB.request("GET", "/api/v1/timeline/divisions");
    assert.deepEqual(
      asB.json.data.map((d: { name: string; mine: boolean }) => [d.name, d.mine]),
      [
        ["Acara", false],
        ["Konsumsi", true],
      ],
    );
    const asKetua = await ketua.request("GET", "/api/v1/timeline/divisions");
    assert.deepEqual(
      asKetua.json.data.map((d: { mine: boolean }) => d.mine),
      [false, false],
      "ketua hanya melihat",
    );
    const asAdmin = await admin.request("GET", "/api/v1/timeline/divisions");
    assert.deepEqual(
      asAdmin.json.data.map((d: { mine: boolean }) => d.mine),
      [true, true],
    );
    assert.equal((await petugas.request("GET", "/api/v1/timeline/divisions")).status, 403);
  });
});

describe("isolasi antar-koordinator", () => {
  it("koordinator dapat MELIHAT daftar pekerjaan divisi lain, tetapi tidak membuat, mengubah, mencatat, atau membaca isi catatannya", async () => {
    const otherTasks = await koorA.request("GET", `/api/v1/timeline/tasks?division_id=${divB}`);
    assert.equal(otherTasks.status, 200);
    assert.equal(otherTasks.json.data.length, 1);
    assert.equal(otherTasks.json.data[0].title, "Pesan konsumsi");
    assert.equal(
      (
        await koorA.request("POST", "/api/v1/timeline/tasks", {
          division_id: divB,
          title: "Curang",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await koorA.request("PUT", `/api/v1/timeline/tasks/${taskB}`, {
          title: "Ubah diam-diam",
          status: "selesai",
        })
      ).status,
      403,
    );
    assert.equal((await koorA.request("GET", `/api/v1/timeline/tasks/${taskB}/notes`)).status, 403);
    assert.equal(
      (await koorA.request("POST", `/api/v1/timeline/tasks/${taskB}/notes`, { note: "x" })).status,
      403,
    );
    const row = await pool.query("SELECT title, status FROM tasks WHERE id = $1", [taskB]);
    assert.deepEqual(row.rows[0], { title: "Pesan konsumsi", status: "berjalan" });
    assert.equal(
      (await pool.query("SELECT COUNT(*)::int AS n FROM tasks WHERE title = 'Curang'")).rows[0].n,
      0,
    );
  });

  it("pekerjaan tidak ada → 404", async () => {
    assert.equal(
      (await koorA.request("PUT", "/api/v1/timeline/tasks/999999", { title: "x", status: "belum" }))
        .status,
      404,
    );
    assert.equal((await koorA.request("GET", "/api/v1/timeline/tasks/999999/notes")).status, 404);
  });
});

describe("ketua hanya melihat", () => {
  it("ketua membaca semuanya tetapi tidak dapat mengubah apa pun", async () => {
    assert.equal(
      (await ketua.request("GET", `/api/v1/timeline/tasks?division_id=${divB}`)).status,
      200,
    );
    assert.equal((await ketua.request("GET", `/api/v1/timeline/tasks/${taskB}/notes`)).status, 200);
    assert.equal(
      (await ketua.request("POST", "/api/v1/timeline/tasks", { division_id: divB, title: "x" }))
        .status,
      403,
    );
    assert.equal(
      (
        await ketua.request("PUT", `/api/v1/timeline/tasks/${taskB}`, {
          title: "x",
          status: "selesai",
        })
      ).status,
      403,
    );
    assert.equal(
      (await ketua.request("POST", `/api/v1/timeline/tasks/${taskB}/notes`, { note: "x" })).status,
      403,
    );
    assert.equal(
      (await ketua.request("POST", `/api/v1/timeline/tasks/${taskB}/delete`)).status,
      403,
    );
  });

  it("petugas ditolak dari seluruh endpoint timeline", async () => {
    for (const [m, u] of [
      ["GET", `/api/v1/timeline/tasks?division_id=${divA}`],
      ["GET", "/api/v1/timeline/report"],
      ["GET", `/api/v1/timeline/tasks/${taskA}/notes`],
    ] as const)
      assert.equal((await petugas.request(m, u)).status, 403, u);
  });
});

describe("pekerjaan, catatan, dan laporan", () => {
  it("koordinator mengubah status/tenggat divisinya dan menambah catatan progres", async () => {
    const upd = await koorA.request("PUT", `/api/v1/timeline/tasks/${taskA}`, {
      title: "Susun rundown final",
      status: "berjalan",
      due_date: dayOffset(-2),
    });
    assert.equal(upd.status, 200);
    assert.equal(
      (
        await koorA.request("POST", `/api/v1/timeline/tasks/${taskA}/notes`, {
          note: "Draf 1 selesai, menunggu masukan.",
        })
      ).status,
      201,
    );
    const notes = await ketua.request("GET", `/api/v1/timeline/tasks/${taskA}/notes`);
    assert.equal(notes.json.data.length, 1);
    assert.equal(notes.json.data[0].author, "Uji koordinator");
    const tasks = await koorA.request("GET", `/api/v1/timeline/tasks?division_id=${divA}`);
    assert.equal(tasks.json.data[0].note_count, 1);
    assert.equal(tasks.json.data[0].overdue, true);
  });

  it("masukan tidak sah ditolak", async () => {
    for (const bad of [
      { division_id: divA, title: "" },
      { division_id: divA, title: "x", status: "bebas" },
      { division_id: divA, title: "x", due_date: "31/12/2026" },
    ])
      assert.equal(
        (await koorA.request("POST", "/api/v1/timeline/tasks", bad)).status,
        422,
        JSON.stringify(bad),
      );
    assert.equal(
      (await koorA.request("POST", `/api/v1/timeline/tasks/${taskA}/notes`, { note: "" })).status,
      422,
    );
  });

  it("laporan ketua: jumlah, keterlambatan, dan catatan terbaru benar", async () => {
    await koorB.request("PUT", `/api/v1/timeline/tasks/${taskB}`, {
      title: "Pesan konsumsi",
      status: "selesai",
      due_date: dayOffset(5),
    });
    const res = await ketua.request("GET", "/api/v1/timeline/report");
    assert.equal(res.status, 200);
    const { totals, divisions, recent_notes } = res.json.data;
    assert.equal(totals.total, 2);
    assert.equal(totals.selesai, 1);
    assert.equal(totals.terlambat, 1, "tugas Acara lewat tenggat dan belum selesai");
    const acara = divisions.find((d: { name: string }) => d.name === "Acara");
    assert.equal(acara.berjalan, 1);
    assert.equal(acara.terlambat, 1);
    assert.equal(recent_notes.length, 1);
    assert.equal(recent_notes[0].division, "Acara");
    // Beranda: koordinator melihat progres SEMUA divisi (D46), tetapi isi catatan hanya divisinya sendiri.
    const asA = await koorA.request("GET", "/api/v1/timeline/report");
    assert.equal(asA.status, 200);
    assert.equal(asA.json.data.divisions.length, 2);
    assert.equal(asA.json.data.totals.total, 2);
    assert.deepEqual(
      asA.json.data.divisions.map((d: { name: string; mine: boolean }) => [d.name, d.mine]),
      [
        ["Acara", true],
        ["Konsumsi", false],
      ],
    );
    assert.equal(asA.json.data.recent_notes.length, 1, "catatan Acara milik divisinya sendiri");
    const asB = await koorB.request("GET", "/api/v1/timeline/report");
    assert.equal(asB.status, 200);
    assert.equal(asB.json.data.divisions.length, 2);
    assert.equal(
      asB.json.data.recent_notes.length,
      0,
      "isi catatan divisi Acara tidak boleh bocor ke koordinator Konsumsi",
    );
    assert.doesNotMatch(JSON.stringify(asB.json.data), /Draf 1 selesai/);
  });

  it("tugas selesai tidak dihitung terlambat walau lewat tenggat", async () => {
    await koorA.request("PUT", `/api/v1/timeline/tasks/${taskA}`, {
      title: "Susun rundown final",
      status: "selesai",
      due_date: dayOffset(-2),
    });
    const res = await admin.request("GET", "/api/v1/timeline/report");
    assert.equal(res.json.data.totals.terlambat, 0);
  });

  it("hanya superadmin yang menghapus pekerjaan; semuanya tercatat di audit", async () => {
    assert.equal(
      (await koorA.request("POST", `/api/v1/timeline/tasks/${taskA}/delete`)).status,
      403,
    );
    assert.equal(
      (await admin.request("POST", `/api/v1/timeline/tasks/${taskA}/delete`)).status,
      200,
    );
    assert.equal(
      (await pool.query("SELECT COUNT(*)::int AS n FROM task_notes")).rows[0].n,
      0,
      "catatan ikut terhapus",
    );
    const actions = (await pool.query("SELECT DISTINCT action FROM audit_log")).rows.map(
      (r) => r.action,
    );
    for (const a of [
      "division_created",
      "division_member_added",
      "task_created",
      "task_updated",
      "task_note_added",
      "task_deleted",
    ]) {
      assert.ok(actions.includes(a), a);
    }
  });

  it("koordinator dan ketua tetap tidak dapat menyentuh data wisudawan", async () => {
    for (const client of [koorA, ketua]) {
      assert.equal((await client.request("GET", "/api/v1/admin/students")).status, 403);
      assert.equal(
        (await client.request("GET", "/api/v1/admin/attendances/export?session_id=1")).status,
        403,
      );
      assert.equal(
        (await client.request("POST", "/api/v1/scan/manual", { session_id: 1, nim: "1" })).status,
        403,
      );
    }
  });

  it("tanpa CSRF atau tanpa login ditolak", async () => {
    assert.equal(
      (
        await koorA.request(
          "POST",
          "/api/v1/timeline/tasks",
          { division_id: divA, title: "x" },
          { csrf: false },
        )
      ).status,
      419,
    );
    assert.equal((await new Client(app).request("GET", "/api/v1/timeline/divisions")).status, 401);
  });
});
