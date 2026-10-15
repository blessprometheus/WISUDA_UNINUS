const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const out = process.argv[2];
(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  await page.goto((process.env.E2E_BASE || "http://localhost:3100") + "/", {
    waitUntil: "networkidle",
  });

  const input = page.getByLabel("Nomor Induk Mahasiswa (NIM)");
  const submit = page.getByRole("button", { name: /Cari data saya/ });

  // 1. NIM kosong
  await submit.click();
  await page.getByRole("alert").filter({ hasText: "Masukkan NIM" }).waitFor();
  console.log("1 kosong: pesan tampil");

  // 2. NIM tidak ada
  await input.fill("99999999999");
  await submit.click();
  await page.getByRole("alert").filter({ hasText: "tidak ditemukan" }).waitFor();
  console.log("2 tidak ada: pesan tampil");

  // 3. Format tidak valid
  await input.fill("DROP TABLE;");
  await submit.click();
  await page.getByRole("alert").filter({ hasText: "Format NIM tidak valid" }).waitFor();
  console.log("3 format salah: pesan tampil");

  // 4. NIM benar (huruf kecil/spasi dinormalkan)
  await input.fill("  10000000001 ");
  await submit.click();
  const card = page.getByRole("article", { name: /Data wisudawan dan kartu QR/ });
  await card.waitFor();
  assert.ok((await card.innerText()).includes("Ani Rekaan"));
  assert.ok((await card.innerText()).includes("S1 Teknik Informatika"));
  const img = card.getByRole("img");
  await img.waitFor();
  const loaded = await img.evaluate((el) => el.complete && el.naturalWidth > 0);
  assert.equal(loaded, true, "gambar QR harus termuat");
  console.log("4 sukses: nama, prodi, QR termuat");
  await page.screenshot({ path: `${out}/qr-mobile-result.png`, fullPage: false });
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/qr-mobile-card.png` });

  // 5. Unduh
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    card.getByRole("link", { name: "Unduh QR" }).click(),
  ]);
  assert.equal(download.suggestedFilename(), "QR-WISUDA-70-10000000001.png");
  const path = await download.path();
  const bytes = require("node:fs").readFileSync(path);
  assert.equal(bytes.subarray(0, 4).toString("hex"), "89504e47");
  console.log("5 unduh: berkas PNG valid,", bytes.length, "byte");

  // 6. Keyboard: Tab dari input ke tombol, Enter mengirim
  await input.fill("10000000002");
  await input.press("Enter");
  await page.getByText("Budi Rekaan").waitFor();
  console.log("6 Enter mengirim form");

  // 7. Tanpa overflow horizontal
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  assert.equal(overflow, 0);
  console.log("7 overflow horizontal:", overflow);
  console.log("kesalahan konsol:", consoleErrors.length ? consoleErrors : "tidak ada");
  await browser.close();
})().catch((e) => {
  console.error("GAGAL:", e.message);
  process.exit(1);
});
