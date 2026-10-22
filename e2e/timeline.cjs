const PASS = process.env.E2E_PASSWORD;
if (!PASS) throw new Error("E2E_PASSWORD wajib diisi (sandi akun uji palsu).");
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const out = process.argv[2];
const BASE = process.env.E2E_BASE || "http://localhost:3100";

let lastPage = null;
async function newUser(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const page = await ctx.newPage();
  lastPage = page;
  page.on("dialog", (d) => d.accept());
  return { ctx, page };
}
async function login(page, email, password) {
  await page.goto(BASE + "/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
}

const { execFileSync } = require("node:child_process");
const psql = (q) =>
  execFileSync(
    process.env.PSQL_BIN || "psql",
    ["-h", "127.0.0.1", "-p", "55433", "-U", "wisuda_test", "-d", "wisuda_test_e2e", "-q", "-c", q],
    { stdio: "ignore" },
  );

(async () => {
  psql(
    "DELETE FROM task_notes; DELETE FROM tasks; DELETE FROM user_divisions; DELETE FROM divisions; DELETE FROM user_sessions; DELETE FROM users WHERE email IN ('koora@uji.id','koorb@uji.id','ketua@uji.id'); UPDATE users SET failed_logins=0, locked_until=NULL;",
  );
  const browser = await chromium.launch({ channel: "chrome" });

  // 1. Superadmin -> /admin (tanpa 2FA)
  const sa = await newUser(browser);
  await login(sa.page, "super@uji.id", PASS);
  await sa.page.waitForURL(/\/admin$/);
  console.log("1 superadmin masuk");

  // 2. Buat akun koordinator A, B dan ketua lewat UI
  const creds = {};
  await sa.page.getByRole("link", { name: "Pengguna" }).click();
  await sa.page.getByRole("heading", { name: "Pengguna", exact: true }).waitFor();
  for (const [key, name, email, role] of [
    ["A", "Koordinator Acara", "koora@uji.id", "Koordinator divisi"],
    ["B", "Koordinator Konsumsi", "koorb@uji.id", "Koordinator divisi"],
    ["K", "Ketua Panitia", "ketua@uji.id", "Ketua"],
  ]) {
    const f = sa.page.locator("form").first();
    await f.getByLabel("Nama").fill(name);
    await f.getByLabel("Email").fill(email);
    await f.getByLabel("Peran").selectOption({ label: role });
    await f.getByRole("button", { name: "Buat akun" }).click();
    await sa.page.getByText(`Kata sandi sementara untuk ${email}`).waitFor();
    creds[key] = { email, password: (await sa.page.locator("p.select-all").innerText()).trim() };
    await sa.page.getByRole("button", { name: "Sudah saya catat, tutup" }).click();
  }
  console.log("2 tiga akun dibuat lewat UI");

  // 3. Divisi + penugasan
  await sa.page.getByRole("link", { name: "Divisi & Timeline" }).click();
  await sa.page.getByRole("heading", { name: "Divisi & Timeline" }).waitFor();
  for (const name of ["Acara", "Konsumsi"]) {
    await sa.page.getByLabel("Nama divisi").fill(name);
    await sa.page.getByRole("button", { name: "Buat divisi" }).click();
    await sa.page.getByRole("heading", { name }).waitFor();
  }
  const assign = async (division, who) => {
    const card = sa.page.locator("section", {
      has: sa.page.getByRole("heading", { name: division, exact: true }),
    });
    await card
      .getByLabel("Tugaskan koordinator")
      .selectOption({ label: new RegExp(who).source ? undefined : undefined })
      .catch(() => {});
  };
  void assign;
  for (const [division, email] of [
    ["Acara", "koora@uji.id"],
    ["Konsumsi", "koorb@uji.id"],
  ]) {
    const card = sa.page.locator("section", {
      has: sa.page.getByRole("heading", { name: division, exact: true }),
    });
    const select = card.getByLabel("Tugaskan koordinator");
    const option = await select.locator("option", { hasText: email }).getAttribute("value");
    await select.selectOption(option);
    await card.getByRole("button", { name: "Tugaskan" }).click();
    await card.getByText(email).waitFor();
  }
  await sa.page.screenshot({ path: `${out}/t-divisi.png`, fullPage: true });
  console.log("3 divisi dibuat dan koordinator ditugaskan");

  // 4. Koordinator A: hanya divisi Acara; tambah, ubah, catatan
  const a = await newUser(browser);
  await login(a.page, creds.A.email, creds.A.password);
  await a.page.waitForURL(/\/timeline$/);
  await a.page.getByText("Koordinator divisi").first().waitFor();
  const options = await a.page.locator("select").first().locator("option").allInnerTexts();
  assert.equal(options.length, 1, "koordinator hanya melihat divisinya");
  assert.ok(options[0].startsWith("Acara"));
  assert.equal(
    await a.page.getByRole("tab", { name: "Laporan progres" }).count(),
    0,
    "koordinator tidak punya tab laporan",
  );
  await a.page.getByLabel("Judul pekerjaan").first().fill("Susun rundown acara");
  await a.page.getByLabel("Tenggat").first().fill("2026-10-01");
  await a.page.getByRole("button", { name: "Tambah", exact: true }).click();
  const row = a.page.locator("tr", { hasText: "Susun rundown acara" });
  await row.waitFor();
  await row.getByText("terlambat").waitFor();
  await row.getByRole("button", { name: "Ubah" }).click();
  await a.page
    .locator("tr", { hasText: "Judul pekerjaan" })
    .getByLabel("Status")
    .selectOption("berjalan");
  await a.page.getByRole("button", { name: "Simpan", exact: true }).click();
  await row.getByText("Berjalan").waitFor();
  await row.getByRole("button", { name: /Catatan/ }).click();
  await a.page
    .getByLabel("Catatan progres baru")
    .fill("Draf pertama selesai, menunggu masukan ketua.");
  await a.page.getByRole("button", { name: "Tambah catatan" }).click();
  await a.page.getByText("Draf pertama selesai").waitFor();
  await a.page.screenshot({ path: `${out}/t-koordinator.png`, fullPage: true });
  console.log("4 koordinator A: tambah, ubah status, catatan; hanya divisinya");

  // 5. Koordinator A tidak dapat mengakses divisi lain / dashboard
  const r = await a.page.evaluate(async () => {
    const divs = await (await fetch("/api/v1/timeline/divisions")).json();
    const res = await fetch("/api/v1/admin/students");
    return { names: divs.data.map((d) => d.name), studentsStatus: res.status };
  });
  assert.deepEqual(r.names, ["Acara"]);
  assert.equal(r.studentsStatus, 403);
  await a.page.goto(BASE + "/admin");
  await a.page.getByRole("heading", { name: "Akses ditolak" }).waitFor();
  console.log("5 koordinator ditolak dari /admin dan data wisudawan");
  await a.ctx.close();

  // 6. Koordinator B membuat pekerjaan selesai di Konsumsi
  const b = await newUser(browser);
  await login(b.page, creds.B.email, creds.B.password);
  await b.page.waitForURL(/\/timeline$/);
  await b.page.getByLabel("Judul pekerjaan").first().fill("Pesan konsumsi");
  await b.page.getByLabel("Status awal").selectOption("selesai");
  await b.page.getByRole("button", { name: "Tambah", exact: true }).click();
  await b.page.locator("tr", { hasText: "Pesan konsumsi" }).getByText("Selesai").waitFor();
  await b.ctx.close();
  console.log("6 koordinator B menambah pekerjaan selesai");

  // 7. Ketua: laporan, hanya melihat
  const k = await newUser(browser);
  await login(k.page, creds.K.email, creds.K.password);
  await k.page.waitForURL(/\/timeline$/);
  await k.page.getByRole("tab", { name: "Laporan progres" }).waitFor();
  await k.page.getByText("pekerjaan selesai").waitFor();
  await k.page.getByText("Draf pertama selesai").waitFor();
  const report = (await k.page.locator("main").innerText()).replace(/\s+/g, " ");
  assert.ok(report.includes("1 dari 2"), "ringkasan 1 dari 2 selesai");
  assert.ok(report.includes("1 terlambat"), "ada 1 pekerjaan terlambat");
  assert.ok(report.includes("Draf pertama selesai"), "catatan terbaru tampil");
  await k.page.screenshot({ path: `${out}/t-ketua.png`, fullPage: true });
  await k.page.getByRole("button", { name: "Lihat pekerjaan" }).first().click();
  await k.page.getByText("Hanya lihat").waitFor();
  assert.equal(await k.page.getByRole("button", { name: "Tambah", exact: true }).count(), 0);
  assert.equal(await k.page.getByRole("button", { name: "Ubah" }).count(), 0);
  const w = await k.page.evaluate(async () => {
    const csrf =
      document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.split("=")[1] ?? "";
    const res = await fetch("/api/v1/timeline/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-XSRF-TOKEN": decodeURIComponent(csrf) },
      body: JSON.stringify({ division_id: 1, title: "curang" }),
    });
    return res.status;
  });
  assert.equal(w, 403);
  console.log("7 ketua: laporan benar, tanpa tombol ubah, penulisan ditolak server (403)");
  await k.ctx.close();

  // 8. Superadmin melihat laporan juga
  await sa.page.goto(BASE + "/timeline");
  await sa.page.getByRole("tab", { name: "Laporan progres" }).waitFor();
  console.log("8 superadmin dapat membuka timeline");
  await browser.close();
})().catch(async (e) => {
  if (lastPage) {
    await lastPage.screenshot({ path: `${out}/t-gagal.png`, fullPage: true }).catch(() => {});
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
