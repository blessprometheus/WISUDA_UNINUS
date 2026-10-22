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

// SEMUA data di bawah ini rekaan.
const CSV = [
  "NIM,NAMA,PROGRAM STUDI,ANGKATAN",
  "10000000001,Ani Rekaan,S1 Teknik Informatika,2021",
  "10000000002,Budi Rekaan,S1 Manajemen,2020",
  '10000000003,"=HYPERLINK(""http://jahat.example"")",S1 Manajemen,2022',
  "10000000004,Dedi Rekaan,S2 Ilmu Hukum,2022",
].join("\n");

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;
let admin: Client;
let petugas: Client;
let sessionId = 0;
const tokens = new Map<string, string>();

/** Jendela yang mengelilingi "sekarang" tetapi tetap berada dalam satu tanggal WIB. */
function windowAroundNow() {
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const now = Date.now();
  const startOfDay = Date.parse(`${date}T00:00:00+07:00`);
  const endOfDay = Date.parse(`${date}T23:59:59+07:00`);
  return {
    event_date: date,
    starts_at: new Date(Math.max(startOfDay, now - 3_600_000)).toISOString(),
    ends_at: new Date(Math.min(endOfDay, now + 3_600_000)).toISOString(),
  };
}

const scan = (client: Client, nimOrToken: string, manual = false) =>
  client.request("POST", manual ? "/api/v1/scan/manual" : "/api/v1/scan", {
    session_id: sessionId,
    [manual ? "nim" : "token"]: nimOrToken,
    device_label: "Meja 1",
  });

before(async () => {
  await resetDatabase();
  app = await buildApp();
  admin = await loginSuperadmin(app, "admin@uji.id");
  await createTestUser("petugas@uji.id", "petugas");
  await createTestUser("koordinator@uji.id", "koordinator");
  await createTestUser("ketua@uji.id", "ketua");
  petugas = await loginAs(app, "petugas@uji.id");
  const imported = await admin.request("POST", "/api/v1/admin/students/import", CSV, {
    contentType: "text/csv",
  });
  assert.equal(imported.status, 200);
  const rows = await pool.query("SELECT nim, attendance_token FROM students");
  for (const row of rows.rows) tokens.set(row.nim, row.attendance_token);
  const created = await admin.request("POST", "/api/v1/admin/attendance-sessions", {
    kind: "gladi",
    name: "Gladi Resik",
    ...windowAroundNow(),
  });
  assert.equal(created.status, 201);
  sessionId = created.json.data.id as number;
});

after(async () => {
  await app.close();
  await closeDatabase();
});

describe("sesi", () => {
  it("petugas tidak dapat membuat atau mengaktifkan sesi", async () => {
    assert.equal(
      (
        await petugas.request("POST", "/api/v1/admin/attendance-sessions", {
          kind: "gladi",
          name: "x",
        })
      ).status,
      403,
    );
    assert.equal(
      (await petugas.request("POST", `/api/v1/admin/attendance-sessions/${sessionId}/activate`))
        .status,
      403,
    );
  });

  it("jam di luar tanggal acara atau terbalik ditolak", async () => {
    const w = windowAroundNow();
    const reversed = await admin.request("POST", "/api/v1/admin/attendance-sessions", {
      kind: "hari_h",
      name: "Hari-H",
      event_date: w.event_date,
      starts_at: w.ends_at,
      ends_at: w.starts_at,
    });
    assert.equal(reversed.status, 422);
    const wrongDate = await admin.request("POST", "/api/v1/admin/attendance-sessions", {
      kind: "hari_h",
      name: "Hari-H",
      event_date: "2030-01-01",
      starts_at: w.starts_at,
      ends_at: w.ends_at,
    });
    assert.equal(wrongDate.status, 422);
  });

  it("jam yang bertabrakan dengan sesi lain ditolak", async () => {
    const dup = await admin.request("POST", "/api/v1/admin/attendance-sessions", {
      kind: "hari_h",
      name: "Kembar",
      ...windowAroundNow(),
    });
    assert.equal(dup.status, 409);
    assert.match(String(dup.json.message), /bertabrakan dengan sesi "Gladi Resik"/);
  });

  it("dua sesi pada tanggal yang sama diperbolehkan (pagi dan siang), asal jam tidak beririsan", async () => {
    const day = "2030-12-10";
    const make = (name: string, from: string, to: string) =>
      admin.request("POST", "/api/v1/admin/attendance-sessions", {
        kind: "hari_h",
        name,
        event_date: day,
        starts_at: `${day}T${from}:00+07:00`,
        ends_at: `${day}T${to}:00+07:00`,
      });
    assert.equal((await make("Sesi Pagi", "07:00", "11:00")).status, 201);
    assert.equal((await make("Sesi Siang", "12:00", "16:00")).status, 201);
    // nama kembar pada tanggal yang sama (huruf besar/kecil tidak dibedakan) ditolak
    const sameName = await make("sesi pagi", "17:00", "18:00");
    assert.equal(sameName.status, 409);
    assert.match(String(sameName.json.message), /nama ini pada tanggal tersebut/);
    // beririsan dengan sesi siang ditolak; bersebelahan persis (jam akhir = jam mulai) boleh
    const overlap = await make("Sesi Sore", "15:00", "17:00");
    assert.equal(overlap.status, 409);
    assert.match(String(overlap.json.message), /bertabrakan dengan sesi "Sesi Siang"/);
    assert.equal((await make("Sesi Sore", "16:00", "17:00")).status, 201);
    // mengubah sesi agar beririsan dengan sesi lain ditolak; mengubah jamnya sendiri boleh
    const rows = await pool.query(
      "SELECT id, name FROM attendance_sessions WHERE event_date = $1",
      [day],
    );
    const idOf = (name: string) => rows.rows.find((r) => r.name === name).id as number;
    const put = (id: number, name: string, from: string, to: string) =>
      admin.request("PUT", `/api/v1/admin/attendance-sessions/${id}`, {
        kind: "hari_h",
        name,
        event_date: day,
        starts_at: `${day}T${from}:00+07:00`,
        ends_at: `${day}T${to}:00+07:00`,
      });
    assert.equal((await put(idOf("Sesi Siang"), "Sesi Siang", "10:30", "16:00")).status, 409);
    assert.equal((await put(idOf("Sesi Siang"), "Sesi Siang", "12:30", "15:30")).status, 200);
    // bersih-bersih agar tes lain tidak terpengaruh
    await pool.query("DELETE FROM attendance_sessions WHERE event_date = $1", [day]);
  });
});

describe("pemindaian", () => {
  it("sesi belum diaktifkan → tidak tercatat", async () => {
    const res = await scan(petugas, tokens.get("10000000001")!);
    assert.equal(res.json.data.result, "not_active");
    assert.equal((await pool.query("SELECT 1 FROM attendances")).rowCount, 0);
  });

  it("setelah diaktifkan: QR tercatat, ulang → duplicate, token asing → unknown", async () => {
    assert.equal(
      (await admin.request("POST", `/api/v1/admin/attendance-sessions/${sessionId}/activate`))
        .status,
      200,
    );
    const first = await scan(petugas, tokens.get("10000000001")!);
    assert.equal(first.json.data.result, "recorded");
    assert.equal(first.json.data.student.nim, "10000000001");
    assert.equal(first.json.data.outside_window, false);
    assert.equal((await scan(petugas, tokens.get("10000000001")!)).json.data.result, "duplicate");
    assert.equal((await scan(petugas, "0".repeat(32))).json.data.result, "unknown");
    assert.equal((await scan(petugas, "bukan-token")).status, 422);
  });

  it("4 scanner memindai QR yang sama bersamaan → tepat satu tercatat", async () => {
    const token = tokens.get("10000000002")!;
    const results = await Promise.all(Array.from({ length: 20 }, () => scan(petugas, token)));
    const recorded = results.filter((r) => r.json.data.result === "recorded").length;
    const duplicate = results.filter((r) => r.json.data.result === "duplicate").length;
    assert.equal(recorded, 1);
    assert.equal(duplicate, 19);
    const count = await pool.query(
      "SELECT COUNT(*)::int AS n FROM attendances a JOIN students s ON s.id = a.student_id WHERE s.nim = '10000000002'",
    );
    assert.equal(count.rows[0].n, 1);
  });

  it("input NIM manual tercatat dengan metode manual", async () => {
    const res = await scan(petugas, "10000000004", true);
    assert.equal(res.json.data.result, "recorded");
    const row = await pool.query(
      "SELECT method, outside_window FROM attendances a JOIN students s ON s.id = a.student_id WHERE s.nim = '10000000004'",
    );
    assert.equal(row.rows[0].method, "manual");
    assert.equal(row.rows[0].outside_window, false);
  });

  it("di luar jendela: QR ditolak, manual diterima tetapi ditandai (D26)", async () => {
    await pool.query(
      "UPDATE attendance_sessions SET starts_at = NOW() - INTERVAL '2 days', ends_at = NOW() - INTERVAL '1 day' WHERE id = $1",
      [sessionId],
    );
    const qr = await scan(petugas, tokens.get("10000000003")!);
    assert.equal(qr.json.data.result, "outside_window");
    const manual = await scan(petugas, "10000000003", true);
    assert.equal(manual.json.data.result, "recorded");
    assert.equal(manual.json.data.outside_window, true);
    const row = await pool.query(
      "SELECT outside_window FROM attendances a JOIN students s ON s.id = a.student_id WHERE s.nim = '10000000003'",
    );
    assert.equal(row.rows[0].outside_window, true);
  });

  it("NIM manual tak dikenal → unknown, lalu dapat dicatat sebagai 'tidak terdaftar' (tidak dihitung hadir)", async () => {
    const before = (await pool.query("SELECT COUNT(*)::int AS n FROM attendances")).rows[0].n;
    assert.equal((await scan(petugas, "77777777777", true)).json.data.result, "unknown");
    const entry = await petugas.request("POST", "/api/v1/scan/unregistered", {
      session_id: sessionId,
      nim: "77777777777",
      name: "Tamu Rekaan",
    });
    assert.equal(entry.status, 201);
    assert.equal(entry.json.data.counted_as_present, false);
    assert.equal(
      (await pool.query("SELECT COUNT(*)::int AS n FROM attendances")).rows[0].n,
      before,
    );
    const list = await admin.request("GET", `/api/v1/admin/unregistered?session_id=${sessionId}`);
    assert.equal(list.json.data.length, 1);
    const review = await admin.request(
      "POST",
      `/api/v1/admin/unregistered/${list.json.data[0].id}/review`,
    );
    assert.equal(review.status, 200);
    assert.equal(
      (await admin.request("POST", `/api/v1/admin/unregistered/${list.json.data[0].id}/review`))
        .status,
      404,
    );
  });

  it("wisudawan nonaktif tidak dapat dicatat", async () => {
    await pool.query(
      "INSERT INTO students (ceremony_id, nim, name, study_program, attendance_token, is_active) SELECT id, '10000000099', 'Nonaktif Rekaan', 'S1 X', repeat('a', 32), FALSE FROM ceremonies LIMIT 1",
    );
    assert.equal((await scan(petugas, "10000000099", true)).json.data.result, "inactive_student");
  });

  it("tanpa CSRF atau tanpa login ditolak", async () => {
    const noCsrf = await petugas.request(
      "POST",
      "/api/v1/scan",
      { session_id: sessionId, token: "0".repeat(32) },
      { csrf: false },
    );
    assert.equal(noCsrf.status, 419);
    const anon = await new Client(app).request(
      "POST",
      "/api/v1/scan",
      { session_id: sessionId, token: "0".repeat(32) },
      { csrf: false },
    );
    assert.equal(anon.status, 401);
  });
});

describe("pengelolaan sesi setelah ada kehadiran", () => {
  it("jam dapat diubah tanpa deploy; tanggal tidak", async () => {
    const w = windowAroundNow();
    const timeOnly = await admin.request("PUT", `/api/v1/admin/attendance-sessions/${sessionId}`, {
      kind: "gladi",
      name: "Gladi Resik",
      ...w,
    });
    assert.equal(timeOnly.status, 200);
    assert.equal(timeOnly.json.data.window_open, true);
    const moveDate = await admin.request("PUT", `/api/v1/admin/attendance-sessions/${sessionId}`, {
      kind: "gladi",
      name: "Gladi Resik",
      event_date: "2030-01-01",
      starts_at: "2030-01-01T08:00:00+07:00",
      ends_at: "2030-01-01T10:00:00+07:00",
    });
    assert.equal(moveDate.status, 409);
  });

  it("mengaktifkan sesi lain menonaktifkan yang lama (hanya satu aktif)", async () => {
    const other = await admin.request("POST", "/api/v1/admin/attendance-sessions", {
      kind: "hari_h",
      name: "Hari-H",
      event_date: "2030-12-05",
      starts_at: "2030-12-05T07:00:00+07:00",
      ends_at: "2030-12-05T12:00:00+07:00",
    });
    assert.equal(other.status, 201);
    await admin.request("POST", `/api/v1/admin/attendance-sessions/${other.json.data.id}/activate`);
    const active = await pool.query("SELECT id FROM attendance_sessions WHERE is_active");
    assert.equal(active.rowCount, 1);
    assert.equal(active.rows[0].id, other.json.data.id);
    await admin.request("POST", `/api/v1/admin/attendance-sessions/${sessionId}/activate`);
  });
});

describe("rekap dan ekspor", () => {
  it("statistik: jumlah hadir, manual, di luar jam, dan yang belum ditinjau", async () => {
    const res = await admin.request("GET", `/api/v1/admin/dashboard/stats?session_id=${sessionId}`);
    const d = res.json.data;
    assert.equal(d.total_students, 4);
    assert.equal(d.present_count, 4);
    assert.equal(d.manual_count, 2);
    assert.equal(d.outside_window_count, 1);
    assert.equal(d.unregistered_pending, 0);
    assert.ok(d.by_study_program.length >= 3);
  });

  it("ekspor CSV menetralkan formula injection dan mencatat audit", async () => {
    const res = await admin.request(
      "GET",
      `/api/v1/admin/attendances/export?session_id=${sessionId}`,
    );
    assert.equal(res.status, 200);
    assert.match(String(res.headers["content-type"]), /text\/csv/);
    assert.ok(res.text.includes(`"'=HYPERLINK(`), "sel berawalan = harus diberi apostrof");
    assert.ok(!res.text.includes(`,"=HYPERLINK`), "tidak boleh ada sel rumus mentah");
    assert.equal(
      (await pool.query("SELECT 1 FROM audit_log WHERE action = 'attendance_exported'")).rowCount,
      1,
    );
  });

  it("daftar kehadiran berpaginasi", async () => {
    const res = await admin.request(
      "GET",
      `/api/v1/admin/attendances?session_id=${sessionId}&per_page=2`,
    );
    assert.equal(res.json.data.length, 2);
    assert.equal(res.json.meta!.total, 4);
    assert.equal(res.json.meta!.last_page, 2);
  });
});

describe("matriks otorisasi per peran", () => {
  const SUPERADMIN_ONLY: Array<["GET" | "POST", string]> = [
    ["GET", "/api/v1/admin/users"],
    ["GET", "/api/v1/admin/students"],
    ["POST", "/api/v1/admin/students"],
    ["POST", "/api/v1/admin/students/import"],
    ["GET", "/api/v1/admin/import-batches"],
    ["GET", "/api/v1/admin/attendance-sessions"],
    ["POST", "/api/v1/admin/attendance-sessions"],
    ["GET", "/api/v1/admin/dashboard/stats?session_id=1"],
    ["GET", "/api/v1/admin/attendances?session_id=1"],
    ["GET", "/api/v1/admin/attendances/export?session_id=1"],
    ["GET", "/api/v1/admin/unregistered?session_id=1"],
    ["POST", "/api/v1/admin/retention/anonymize"],
  ];
  const SCAN_ENDPOINTS: Array<["GET" | "POST", string]> = [
    ["GET", "/api/v1/scan/context"],
    ["GET", "/api/v1/scan/recent?session_id=1"],
    ["POST", "/api/v1/scan"],
    ["POST", "/api/v1/scan/manual"],
    ["POST", "/api/v1/scan/unregistered"],
  ];

  it("petugas, koordinator, dan ketua ditolak di seluruh endpoint /admin", async () => {
    for (const email of ["petugas@uji.id", "koordinator@uji.id", "ketua@uji.id"]) {
      const client = await loginAs(app, email);
      for (const [method, url] of SUPERADMIN_ONLY) {
        const res = await client.request(method, url, method === "POST" ? {} : undefined);
        assert.equal(res.status, 403, `${email} ${method} ${url}`);
      }
    }
  });

  it("koordinator dan ketua juga ditolak di seluruh endpoint pemindaian", async () => {
    for (const email of ["koordinator@uji.id", "ketua@uji.id"]) {
      const client = await loginAs(app, email);
      for (const [method, url] of SCAN_ENDPOINTS) {
        const res = await client.request(method, url, method === "POST" ? {} : undefined);
        assert.equal(res.status, 403, `${email} ${method} ${url}`);
      }
    }
  });

  it("tanpa login semua endpoint terlindungi → 401", async () => {
    const anon = new Client(app);
    for (const [method, url] of [...SUPERADMIN_ONLY, ...SCAN_ENDPOINTS]) {
      if (method === "POST") continue; // POST tanpa CSRF/login diuji terpisah di atas
      assert.equal((await anon.request(method, url)).status, 401, url);
    }
  });
});

describe("retensi (anonimisasi)", () => {
  it("wajib konfirmasi persis; setelahnya data pribadi hilang dan QR lama mati", async () => {
    assert.equal(
      (await admin.request("POST", "/api/v1/admin/retention/anonymize", { confirm: "ya" })).status,
      422,
    );
    const done = await admin.request("POST", "/api/v1/admin/retention/anonymize", {
      confirm: "ANONIMKAN WISUDA 70",
    });
    assert.equal(done.status, 200);
    const rows = await pool.query(
      "SELECT nim, name, cohort_year, is_active, anonymized_at FROM students WHERE anonymized_at IS NOT NULL",
    );
    assert.ok(rows.rowCount! >= 4);
    for (const row of rows.rows) {
      assert.equal(row.name, "[dianonimkan]");
      assert.match(row.nim, /^ANON-\d+$/);
      assert.equal(row.cohort_year, null);
      assert.equal(row.is_active, false);
    }
    assert.equal(
      (await new Client(app).request("POST", "/api/v1/lookup", { nim: "10000000001" })).status,
      404,
    );
    assert.equal((await scan(admin, tokens.get("10000000001")!)).json.data.result, "unknown");
    // Catatan kehadiran (agregat) tetap ada.
    assert.ok((await pool.query("SELECT COUNT(*)::int AS n FROM attendances")).rows[0].n >= 4);
  });
});
