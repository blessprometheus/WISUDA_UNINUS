# Uji end-to-end (Playwright)

Skenario browser nyata: login petugas + pemindai (`staff`), dashboard superadmin (`admin`),
timeline koordinator/ketua (`timeline`), dan cari NIM + QR di landing (`qr`).

**Status:** disalin dari skrip yang dipakai selama pengembangan. Belum dijalankan ulang dari folder ini.

## Prasyarat

- Tumpukan lokal berjalan di `E2E_BASE` (default `http://localhost:3100`) (2FA sudah dihapus, D40).
- Database **uji sementara** (bukan `wisuda_dev`): skrip menjalankan `TRUNCATE`/`DELETE` lewat `psql`.
  Atur `PSQL_BIN` bila `psql` tidak ada di PATH; sesuaikan koneksi di dalam skrip.
- `E2E_PASSWORD`: sandi akun uji palsu yang dibuat di database uji (tidak disimpan di repo).
- Chrome sistem terpasang (`channel: "chrome"`).

## Menjalankan

```
E2E_PASSWORD=<sandi-akun-uji> node e2e/staff.cjs <folder-screenshot>
```
