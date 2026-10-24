const PASS = process.env.E2E_PASSWORD;
if (!PASS) throw new Error("E2E_PASSWORD wajib diisi (sandi akun uji palsu).");
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const out = process.argv[2];
const BASE = process.env.E2E_BASE || "http://localhost:3100";
const PSQL = process.env.PSQL_BIN || "psql";
const PSQL_ARGS = [
  "-h",
  "127.0.0.1",
  "-p",
  "55433",
  "-U",
  "wisuda_test",
  "-d",
  "wisuda_test_e2e",
  "-q",
  "-t",
  "-A",
  "-c",
];
const sql = (q) => execFileSync(PSQL, [...PSQL_ARGS, q], { encoding: "utf8" }).trim();

const CSV = [
  "NO,ANGKATAN,NIM,NAMA,PROGRAM STUDI,TANGGAL LULUS,,,",
  ",2021,10000000010,Ratna Rekaan,S1 Teknik Informatika,01 Oktober 2026,,,",
  ",2020,10000000011,Sari Rekaan,S1 Manajemen,01 Oktober 2026,,,",
  ",2022,10000000011,Orang Lain,S1 Akuntansi,01 Oktober 2026,,,",
  ",2022,10000000001,Ani Rekaan Revisi,S1 Teknik Informatika,01 Oktober 2026,,,",
  ",2022,NIM RUSAK!,Budi Rekaan,S1 Manajemen,,,,",
].join("\n");

let lastPage = null;
(async () => {
  sql(
    "TRUNCATE attendances, unregistered_entries, scan_logs RESTART IDENTITY; DELETE FROM user_sessions; DELETE FROM audit_log;",
  );
  sql(
    "UPDATE users SET failed_logins=0, locked_until=NULL, is_active=true; DELETE FROM users WHERE email='baru@uji.id';",
  );
  sql(
    "DELETE FROM attendance_sessions WHERE name='Hari-H Wisuda'; UPDATE attendance_sessions SET is_active=true;",
  );
  sql("DELETE FROM students WHERE nim IN ('10000000010','10000000011','10000000050');");
  sql(
    "UPDATE students SET name='Ani Rekaan', is_active=true, anonymized_at=NULL WHERE nim='10000000001'; DELETE FROM import_batches;",
  );
  const browser = await chromium.launch({ channel: "chrome" });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const page = await ctx.newPage();
  lastPage = page;
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.accept());

  // 1. Tanpa login -> /masuk
  await page.goto(BASE + "/admin");
  await page.waitForURL(/\/masuk\?next=/);
  console.log("1 tanpa login -> /masuk");

  // 2. Superadmin: login lewat UI -> langsung mendarat di /admin (tanpa 2FA)
  await page.getByLabel("Email").fill("super@uji.id");
  await page.getByLabel("Kata sandi").fill(PASS);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/admin$/);
  await page.getByRole("heading", { name: /Ringkasan Eksekutif/i }).waitFor();
  console.log("2 login superadmin -> /admin");

  // 3. Ringkasan menampilkan data sesi aktif
  await page.getByText("Total Kandidat (Data Awalan)").waitFor();
  assert.ok((await page.locator("main").innerText()).includes("Berdasarkan Program Studi"));
  await page.screenshot({ path: `${out}/a-ringkasan.png` });
  console.log("3 ringkasan tampil");

  // 4. Sesi: buat sesi hari-H, aktifkan, ubah jam
  await page
    .getByRole("link", { name: /Sesi Kehadiran/i })
    .first()
    .click();
  await page.getByRole("heading", { name: "Sesi Kehadiran" }).waitFor();
  const form = page.locator("form").first();
  await form.getByLabel("Jenis").selectOption("hari_h");
  await form.getByLabel("Nama sesi").fill("Hari-H Wisuda");
  await form.getByLabel("Tanggal (WIB)").fill("2026-12-10");
  await form.getByLabel("Jam mulai scan QR").fill("06:30");
  await form.getByLabel("Jam akhir scan QR").fill("12:00");
  await form.getByRole("button", { name: "Buat sesi" }).click();
  await page.getByText("Sesi dibuat.").waitFor();
  const row = page.locator("tr", { hasText: "Hari-H Wisuda" });
  await row.getByRole("button", { name: "Aktifkan" }).click();
  await page.getByText("sesi lain otomatis dinonaktifkan").waitFor();
  assert.equal(sql("SELECT COUNT(*) FROM attendance_sessions WHERE is_active"), "1");
  assert.equal(sql("SELECT name FROM attendance_sessions WHERE is_active"), "Hari-H Wisuda");
  await row.getByRole("button", { name: "Ubah" }).click();
  await page.getByRole("heading", { name: "Ubah sesi" }).waitFor();
  await page.locator("form").nth(1).getByLabel("Jam akhir scan QR").fill("13:30");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await page.getByText("Sesi diperbarui.").waitFor();
  assert.match(
    sql(
      "SELECT to_char(ends_at AT TIME ZONE 'Asia/Jakarta','HH24:MI') FROM attendance_sessions WHERE name='Hari-H Wisuda'",
    ),
    /^13:30$/,
  );
  await page.screenshot({ path: `${out}/a-sesi.png` });
  console.log("4 sesi: buat, aktifkan (hanya satu aktif), ubah jam");

  // 5. Impor: pratinjau -> masalah terlihat -> impor
  await page
    .getByRole("link", { name: /Impor & Sinkronisasi/i })
    .first()
    .click();
  await page.getByRole("heading", { name: /Impor & Sinkronisasi/i }).waitFor();
  assert.equal(sql("SELECT COUNT(*) FROM students"), "3");
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "uji.csv", mimeType: "text/csv", buffer: Buffer.from(CSV, "utf8") });
  assert.ok(
    await page.getByRole("button", { name: "Impor sekarang" }).isDisabled(),
    "impor harus terkunci sebelum pratinjau",
  );
  await page.getByRole("button", { name: "Periksa (pratinjau)" }).click();
  await page.getByText("Hasil pemeriksaan").waitFor();
  const text = await page.locator("main").innerText();
  assert.ok(text.includes("ganda dengan data berbeda"), "NIM ganda berbeda harus dilaporkan");
  assert.ok(
    text.includes("hanya huruf, angka, titik, atau strip"),
    "baris NIM rusak harus dilaporkan",
  );
  assert.equal(sql("SELECT COUNT(*) FROM students"), "3", "pratinjau tidak boleh menyimpan");
  await page.screenshot({ path: `${out}/a-impor-pratinjau.png`, fullPage: true });
  await page.getByRole("button", { name: "Impor sekarang" }).click();
  await page.getByText("Hasil pemrosesan").waitFor();
  assert.equal(
    sql("SELECT COUNT(*) FROM students"),
    "4",
    "hanya 1 baru yang valid (Ratna) + Ani diperbarui",
  );
  assert.equal(sql("SELECT name FROM students WHERE nim='10000000001'"), "Ani Rekaan Revisi");
  assert.equal(
    sql("SELECT attendance_token FROM students WHERE nim='10000000001'"),
    "1111aaaa1111aaaa1111aaaa1111aaaa",
    "token QR tidak boleh berubah",
  );
  console.log("5 impor: pratinjau, masalah terlapor, impor, token stabil");

  // 6. Wisudawan: cari, tambah, ubah, nonaktifkan
  await page
    .getByRole("link", { name: /Database Wisudawan/i })
    .first()
    .click();
  await page.getByText("Tambah Data Awalan").waitFor();
  await page.getByRole("button", { name: "Tambah Data Awalan" }).click();
  await page.getByLabel("NIM Wisudawan *").fill("10000000050");
  await page.getByLabel("Nama Lengkap *").fill("Fani Susulan");
  await page.getByLabel("Program Studi *").fill("S1 Manajemen");
  await page.getByRole("button", { name: "Simpan ke Database Wisudawan" }).click();
  await page.getByText("Wisudawan baru berhasil ditambahkan.").waitFor();
  await page.getByPlaceholder(/Cari NIM, Nama Wisudawan/i).fill("Susulan");
  await page.getByRole("button", { name: "Cari", exact: true }).click();
  const srow = page.locator("tr", { hasText: "Fani Susulan" });
  await srow.waitFor();
  await srow.getByRole("button", { name: "Nonaktifkan" }).click();
  await page.getByText("Fani Susulan dinonaktifkan").waitFor();
  assert.equal(sql("SELECT is_active FROM students WHERE nim='10000000050'"), "f");
  console.log("6 wisudawan: tambah, cari, nonaktifkan");

  // 7. Kehadiran: data dari petugas (disisipkan), ekspor, tidak terdaftar
  const sid = sql("SELECT id FROM attendance_sessions WHERE name='Hari-H Wisuda'");
  const uid = sql("SELECT id FROM users WHERE email='petugas@uji.id'");
  sql(
    `INSERT INTO attendances (student_id, session_id, user_id, method, outside_window, device_label) SELECT id, ${sid}, ${uid}, 'qr', false, 'Meja 1' FROM students WHERE nim='10000000001'`,
  );
  sql(
    `INSERT INTO attendances (student_id, session_id, user_id, method, outside_window, device_label) SELECT id, ${sid}, ${uid}, 'manual', true, 'Meja 2' FROM students WHERE nim='10000000002'`,
  );
  sql(
    `INSERT INTO unregistered_entries (session_id, user_id, typed_nim, typed_name) VALUES (${sid}, ${uid}, '77777777777', 'Tamu Rekaan')`,
  );
  await page
    .getByRole("link", { name: /Presensi & Kehadiran/i })
    .first()
    .click();
  await page.getByRole("heading", { name: /Rekapitulasi Kehadiran/i }).waitFor();
  await page.getByText("Ani Rekaan Revisi").waitFor();
  assert.ok((await page.locator("main").innerText()).toLowerCase().includes("di luar jam"));
  const csv = await page.evaluate(
    async (id) => (await fetch(`/api/v1/admin/attendances/export?session_id=${id}`)).text(),
    sid,
  );
  assert.ok(
    csv.includes("Status") && csv.includes("Hadir") && csv.includes("Belum hadir"),
    "ekspor harus memuat hadir dan belum hadir",
  );
  await page
    .locator("tr", { hasText: "77777777777" })
    .getByRole("button", { name: /Tandai Ditinjau/i })
    .click();
  await page.getByText("Ditandai sudah ditinjau.").waitFor();
  await page.screenshot({ path: `${out}/a-kehadiran.png`, fullPage: true });
  console.log("7 kehadiran: daftar, tanda di luar jam, ekspor CSV, tinjau tidak terdaftar");

  // 8. Ringkasan sekarang menunjukkan angka
  await page
    .getByRole("link", { name: /Dashboard Statistik/i })
    .first()
    .click();
  await page.getByText("Hadir Prosesi / Sesi Aktif").waitFor();
  console.log("8 ringkasan setelah ada kehadiran");

  // 9. Pengguna: buat akun, kata sandi sementara sekali, login dengan akun baru
  await page
    .getByRole("link", { name: /Manajemen Pengguna/i })
    .first()
    .click();
  await page.getByRole("heading", { name: "Pengguna", exact: true }).waitFor();
  const uform = page.locator("form").first();
  await uform.getByLabel("Nama").fill("Petugas Baru");
  await uform.getByLabel("Email").fill("baru@uji.id");
  await uform.getByRole("button", { name: "Buat akun" }).click();
  await page.getByText("Kata sandi sementara untuk baru@uji.id").waitFor();
  const temp = (await page.locator("p.select-all").innerText()).trim();
  assert.ok(temp.length >= 12);
  await page.getByRole("button", { name: "Sudah saya catat, tutup" }).click();
  assert.equal(
    await page.locator("p.select-all").count(),
    0,
    "kata sandi tidak boleh tersisa di layar",
  );
  const ctxB = await browser.newContext();
  const pb = await ctxB.newPage();
  await pb.goto(BASE + "/masuk");
  await pb.getByLabel("Email").fill("baru@uji.id");
  await pb.getByLabel("Kata sandi").fill(temp);
  await pb.getByRole("button", { name: "Masuk" }).click();
  await pb.waitForURL(/\/pemindai$/);
  console.log("9 pengguna: akun dibuat, sandi sementara sekali, login berhasil -> /pemindai");
  // petugas tidak boleh membuka /admin
  await pb.goto(BASE + "/admin");
  await pb.getByRole("heading", { name: "Akses ditolak" }).waitFor();
  console.log("10 petugas ke /admin -> Akses ditolak");
  await ctxB.close();

  // 11. Nonaktifkan akun baru dari UI
  const urow = page.locator("tr", { hasText: "baru@uji.id" });
  await urow.getByRole("button", { name: "Nonaktifkan" }).click();
  await page.getByText("Petugas Baru dinonaktifkan").waitFor();
  assert.equal(sql("SELECT is_active FROM users WHERE email='baru@uji.id'"), "f");
  console.log("11 akun dinonaktifkan");

  // 12. Audit & retensi
  await page
    .getByRole("link", { name: /Audit Log & Retensi/i })
    .first()
    .click();
  await page.getByRole("heading", { name: "Audit & Retensi" }).waitFor();
  const audit = await page.locator("main").innerText();
  for (const a of ["students_import", "session_activated", "user_created", "student_created"])
    assert.ok(audit.includes(a), "audit memuat " + a);
  assert.ok(
    await page.getByRole("button", { name: "Anonimkan sekarang" }).isDisabled(),
    "tombol terkunci sebelum konfirmasi",
  );
  await page.screenshot({ path: `${out}/a-audit.png`, fullPage: true });
  await page.getByLabel(/Ketik/).fill("ANONIMKAN WISUDA 70");
  await page.getByRole("button", { name: "Anonimkan sekarang" }).click();
  await page.getByText("dianonimkan.").waitFor();
  assert.equal(sql("SELECT COUNT(*) FROM students WHERE name <> '[dianonimkan]'"), "0");
  console.log("12 audit tampil; retensi terkunci lalu berhasil dengan konfirmasi");

  // 13. Keluar: sesi dicabut di server
  await page.getByRole("button", { name: "Keluar" }).first().click();
  await page.waitForURL(/\/masuk/);
  const me = await page.evaluate(
    async () => (await fetch("/api/v1/auth/me", { credentials: "same-origin" })).status,
  );
  assert.equal(me, 401);
  console.log("13 keluar: sesi dicabut");

  console.log("kesalahan halaman:", errors.length ? errors : "tidak ada");
  await browser.close();
})().catch(async (e) => {
  if (lastPage) {
    await lastPage.screenshot({ path: `${out}/a-gagal.png`, fullPage: true }).catch(() => {});
    console.error("URL saat gagal:", lastPage.url());
    console.error(
      "Teks:",
      (
        await lastPage
          .locator("body")
          .innerText()
          .catch(() => "")
      )
        .replace(/\s+/g, " ")
        .slice(0, 400),
    );
  }
  console.error("GAGAL:", e.message.split("\n").slice(0, 6).join("\n"));
  process.exit(1);
});
