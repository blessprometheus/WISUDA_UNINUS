import assert from "node:assert/strict";
import { it } from "node:test";

import { csrfOrigins } from "../src/lib/origins.js";

it("alamat LAN harus eksplisit dan hanya berlaku untuk development/test", () => {
  const lan = "http://192.168.1.20:3000";
  for (const environment of ["development", "test"]) {
    const allowed = csrfOrigins("http://localhost:3000", environment, ` ${lan},${lan}, `);
    assert.deepEqual(allowed, ["http://localhost:3000", "http://127.0.0.1:3000", lan]);
    assert.equal(allowed.includes("http://192.168.1.21:3000"), false);
    assert.equal(allowed.includes("http://192.168.1.20:3001"), false);
  }
  for (const environment of ["production", "staging", undefined]) {
    assert.deepEqual(csrfOrigins("https://wisuda.example", environment, lan), [
      "https://wisuda.example",
    ]);
  }
});

it("konfigurasi origin tambahan menolak URL tidak valid, kredensial, path, dan wildcard", () => {
  for (const value of [
    "*",
    "http://*.example",
    "ftp://localhost",
    "http://user:pass@localhost",
    "http://localhost/path",
    "http://localhost?x=1",
    "http://localhost#x",
  ]) {
    assert.throws(() => csrfOrigins("http://localhost:3000", "development", value));
  }
});

it("alias loopback berlaku dua arah dan mempertahankan port/protokol", () => {
  assert.deepEqual(csrfOrigins("http://127.0.0.1:3000", "development"), [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
  ]);
  assert.deepEqual(csrfOrigins("https://localhost:4000", "test"), [
    "https://localhost:4000",
    "https://127.0.0.1:4000",
  ]);
});

it("produksi dan environment tak dikenal hanya menerima origin yang dikonfigurasi", () => {
  for (const environment of ["production", undefined, "staging"]) {
    assert.deepEqual(csrfOrigins("https://localhost:3000", environment), [
      "https://localhost:3000",
    ]);
  }
});

it("domain non-loopback tidak mendapat alias lokal walaupun development", () => {
  for (const origin of [
    "https://wisuda.example",
    "http://192.168.1.10:3000",
    "http://localhost.evil:3000",
  ]) {
    assert.deepEqual(csrfOrigins(origin, "development"), [origin]);
  }
});
