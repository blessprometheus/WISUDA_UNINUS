const PASS = process.env.E2E_PASSWORD;
if (!PASS) throw new Error("E2E_PASSWORD wajib diisi (sandi akun uji palsu).");
const { chromium } = require("playwright");
const OTPAuth = require("otpauth");
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
  "-c",
];
const sql = (q) => execFileSync(PSQL, [...PSQL_ARGS, q], { stdio: "ignore" });
const code = (secret, step = 0) =>
  new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate({
    timestamp: Date.now() + step * 30000,
  });

let lastPage = null;
function resetState() {
  sql(
    "TRUNCATE attendances, unregistered_entries, scan_logs RESTART IDENTITY; DELETE FROM recovery_codes; DELETE FROM user_sessions; UPDATE users SET totp_enabled=false, totp_secret_enc=NULL, totp_last_step=NULL, failed_logins=0, locked_until=NULL;",
  );
  sql(
    "UPDATE attendance_sessions SET is_active=TRUE, starts_at = GREATEST(date_trunc('day', NOW() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta', NOW() - INTERVAL '1 hour'), ends_at = LEAST((date_trunc('day', NOW() AT TIME ZONE 'Asia/Jakarta') + INTERVAL '23 hours 59 minutes') AT TIME ZONE 'Asia/Jakarta', NOW() + INTERVAL '1 hour')",
  );
}
(async () => {
  resetState();
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  // 1. Belum login -> diarahkan ke /masuk
  await page.goto(BASE + "/pemindai");
  await page.waitForURL(/\/masuk\?next=/);
  console.log("1 tanpa login -> /masuk");

  // 2. Login petugas
  await page.getByLabel("Email").fill("petugas@uji.id");
  await page.getByLabel("Kata sandi").fill(PASS);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/pemindai$/);
  await page.getByRole("heading", { name: "Pemindai Kehadiran" }).waitFor();
  await page.screenshot({ path: `${out}/s-gate.png` });
  await page.getByLabel("Meja / titik scanner").selectOption("Meja 2");
  await page.getByRole("button", { name: "Mulai bertugas" }).click();
  await page.getByText("SIAP MEMINDAI").waitFor();
  assert.equal(
    await page.evaluate(() => document.activeElement && document.activeElement.id),
    "scan",
  );
  console.log("2 login petugas, gate, mulai; fokus di kolom scanner");
  await page.screenshot({ path: `${out}/s-idle.png` });

  const scan = page.locator("#scan");
  const panel = page.getByRole("status", { name: "Hasil pemindaian" });
  const bg = (loc) => loc.evaluate((el) => getComputedStyle(el).backgroundColor);

  // 3. QR sah -> hijau
  await scan.fill("1111aaaa1111aaaa1111aaaa1111aaaa");
  await scan.press("Enter");
  await panel.getByText("HADIR", { exact: true }).waitFor();
  assert.ok((await panel.innerText()).includes("Ani Rekaan"));
  assert.equal(await bg(panel), "rgb(11, 122, 62)");
  await page.screenshot({ path: `${out}/s-ok.png` });
  console.log("3 QR sah: HADIR hijau, nama tampil");

  // 4. QR sama lagi -> kuning
  await scan.fill("1111aaaa1111aaaa1111aaaa1111aaaa");
  await scan.press("Enter");
  await panel.getByText("SUDAH HADIR").waitFor();
  assert.equal(await bg(panel), "rgb(245, 197, 24)");
  await page.screenshot({ path: `${out}/s-dup.png` });
  console.log("4 duplikat: kuning");

  // 5. Token asing -> merah; teks bukan token -> merah
  await scan.fill("0".repeat(32));
  await scan.press("Enter");
  await panel.getByText("TIDAK DIKENAL", { exact: true }).waitFor();
  assert.equal(await bg(panel), "rgb(179, 38, 30)");
  await page.screenshot({ path: `${out}/s-err.png` });
  await scan.fill("bukan-token");
  await scan.press("Enter");
  await panel.getByText("KODE TIDAK DIKENAL").waitFor();
  console.log("5 token asing dan format salah: merah");

  // 6. Manual: NIM sah -> hijau; NIM tak ada -> merah + tawaran tidak terdaftar
  await page.locator("#manual").fill("10000000002");
  await page.getByRole("button", { name: "Catat manual" }).click();
  await panel.getByText("Budi Rekaan").waitFor();
  assert.equal(
    await page.evaluate(() => document.activeElement && document.activeElement.id),
    "scan",
  );
  await page.locator("#manual").fill("77777777777");
  await page.getByRole("button", { name: "Catat manual" }).click();
  await page.getByText("tidak ditemukan. Catat sebagai").waitFor();
  await page.getByLabel("Nama (opsional)").fill("Tamu Rekaan");
  await page.getByRole("button", { name: "Catat tidak terdaftar" }).click();
  await page.getByText("dicatat sebagai tidak terdaftar").waitFor();
  console.log("6 manual sah, manual tak dikenal, pencatatan tidak terdaftar");

  // 7. Riwayat memuat kedua nama
  const recentText = await page.locator("ul").innerText();
  assert.ok(recentText.includes("Ani Rekaan") && recentText.includes("Budi Rekaan"));
  console.log("7 riwayat: Ani dan Budi tampil");
  await page.screenshot({ path: `${out}/s-running.png`, fullPage: true });

  // 8. Hasil kembali idle otomatis
  await page.getByText("SIAP MEMINDAI").waitFor({ timeout: 5000 });
  console.log("8 kembali ke SIAP MEMINDAI otomatis");

  // 9. Di luar jendela: QR ditolak, manual diterima dan ditandai
  sql(
    "UPDATE attendance_sessions SET starts_at = NOW() - INTERVAL '2 days', ends_at = NOW() - INTERVAL '1 day'",
  );
  await page.reload();
  await page.getByRole("button", { name: "Mulai bertugas" }).click();
  await page.getByText("Di luar jam scan QR sesi ini").waitFor();
  await scan.fill("3333cccc3333cccc3333cccc3333cccc");
  await scan.press("Enter");
  await panel.getByText("DI LUAR JAM SCAN").waitFor();
  await page.locator("#manual").fill("10000000003");
  await page.getByRole("button", { name: "Catat manual" }).click();
  await panel.getByText("Dicatat di luar jam sesi").waitFor();
  await page.screenshot({ path: `${out}/s-outside.png` });
  console.log("9 di luar jam: QR ditolak, manual diterima dan ditandai");

  // 10. Keluar: harus benar-benar mencabut sesi di server
  await page.getByRole("button", { name: "Keluar" }).first().click();
  await page.waitForURL(/\/masuk/);
  const me = await page.evaluate(
    async () => (await fetch("/api/v1/auth/me", { credentials: "same-origin" })).status,
  );
  assert.equal(me, 401, "sesi harus sudah dicabut di server");
  console.log("10 keluar -> /masuk, sesi dicabut di server (me = 401)");
  await ctx.close();

  // 11. Superadmin: wajib 2FA lewat antarmuka
  const c2 = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const p2 = await c2.newPage();
  lastPage = p2;
  await p2.goto(BASE + "/masuk");
  await p2.getByLabel("Email").fill("super@uji.id");
  await p2.getByLabel("Kata sandi").fill(PASS);
  await p2.getByRole("button", { name: "Masuk" }).click();
  await p2.getByRole("heading", { name: "Aktifkan verifikasi dua langkah" }).waitFor();
  const secret = (await p2.locator("p span.font-mono").innerText()).trim();
  await p2.screenshot({ path: `${out}/s-2fa-setup.png` });
  await p2.getByLabel("Kode 6 digit").fill(code(secret));
  await p2.getByRole("button", { name: "Aktifkan 2FA" }).click();
  await p2.getByText("Simpan kode pemulihan ini sekarang").waitFor();
  assert.equal(await p2.locator("ul.grid li").count(), 10);
  await p2.screenshot({ path: `${out}/s-recovery.png` });
  await p2.getByRole("button", { name: "Saya sudah menyimpan kodenya" }).click();
  await p2.waitForURL(/\/admin$/);
  await p2.getByRole("button", { name: "Keluar" }).first().click();
  await p2.waitForURL(/\/masuk/);
  await p2.getByLabel("Email").waitFor();
  assert.ok(
    !(await p2.locator("body").innerText()).includes("kode pemulihan"),
    "kode pemulihan tidak boleh tersisa setelah keluar",
  );
  await p2.getByLabel("Email").fill("super@uji.id");
  await p2.getByLabel("Kata sandi").fill(PASS);
  await p2.getByRole("button", { name: "Masuk" }).click();
  await p2.getByLabel("Kode verifikasi").fill("000000");
  await p2.getByRole("button", { name: "Verifikasi" }).click();
  await p2.getByText("Kode verifikasi salah").waitFor();
  await p2.getByLabel("Kode verifikasi").fill(code(secret, 1));
  await p2.getByRole("button", { name: "Verifikasi" }).click();
  await p2.waitForURL(/\/admin$/);
  console.log("11 superadmin: setup 2FA, 10 kode pemulihan, login ulang dengan kode");

  console.log("kesalahan halaman:", errors.length ? errors : "tidak ada");
  await browser.close();
})().catch(async (e) => {
  if (lastPage) {
    await lastPage.screenshot({ path: `${out}/gagal.png` }).catch(() => {});
    console.error("URL saat gagal:", lastPage.url());
    console.error(
      "Teks:",
      (
        await lastPage
          .locator("body")
          .innerText()
          .catch(() => "")
      )
        .replace(/s+/g, " ")
        .slice(0, 300),
    );
  }
  console.error("GAGAL:", e.message.split("\n").slice(0, 6).join("\n"));
  process.exit(1);
});
