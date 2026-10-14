# Deployment

> **Status: DRAFT runbook R1** — belum pernah dijalankan di server nyata. Langkah bertanda ⚠ bergantung pada tampilan aaPanel
> yang belum diverifikasi (nama menu dapat berbeda antarversi). Setelah dicoba di staging, perbarui dokumen ini.
> Jangan menyimpan URL panel, password, kunci privat, atau token di dokumen ini.

## 1. Infrastruktur (fakta per 14 Oktober 2026)

| Item | Nilai | Status |
|---|---|---|
| Panel server | aaPanel | Fakta |
| Akses SSH | Tersedia untuk pemilik proyek | Fakta |
| Runtime Node.js | `v24.19.0` (Node 24 LTS) | Fakta |
| DNS `uninus.ac.id` | Dikelola pemilik proyek | Fakta |
| `wisuda.uninus.ac.id` saat ini | Di server lain (situs ke-69) | Fakta |
| Repository | `github.com/aqmalazza/WISUDA_UNINUS_2026` (private) | Fakta |
| Reverse proxy | Kemungkinan Nginx bawaan aaPanel | Asumsi — dicek di §2.A |
| Versi Node target | `24.x`, dikunci via `engines` di `package.json` | Keputusan |

**Prinsip (ADR-0010, merevisi D4):** langkah di bawah dapat dijalankan **pemilik proyek** atau **Claude lewat alias SSH
yang disiapkan pemilik proyek** (mis. `ssh wisuda-staging`). Claude tidak pernah menerima kunci privat, password,
atau URL panel. Staging: Claude boleh menjalankan mandiri; **produksi: butuh "go" eksplisit** untuk tag/commit tertentu.
DNS, SSL domain produksi, firewall, dan pengaturan aaPanel tetap dikerjakan pemilik proyek.

## 2. Runbook R1 — Keputusan D4: manual oleh pemilik proyek

### A. Pengecekan awal (sekali, via SSH) — tempel hasilnya ke Claude

```bash
node -v ; npm -v ; git --version ; nginx -v
df -h /www
echo "--- internet keluar dari server (kode HTTP):"
curl -sS -o /dev/null -w "npm registry: %{http_code}\n" https://registry.npmjs.org/next
curl -sS -o /dev/null -w "google fonts: %{http_code}\n" "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans"
curl -sS -o /dev/null -w "github:       %{http_code}\n" https://github.com
```

| Hasil | Arti | Tindakan |
|---|---|---|
| Semua `200` (github boleh `200`/`301`) dan `node -v` = `v24.x` | Build bisa dilakukan di server | Lanjut §2.B |
| Salah satu bukan `200` | Server tidak bisa mengunduh paket/font | **Berhenti.** Tempel hasilnya ke Claude. Build di laptop Windows **tidak** bisa langsung diunggah (biner `swc`/`sharp` berbeda OS); perlu rancangan lain. |
| `node -v` bukan 24.x | Versi Node salah | Pilih Node 24 di manajer versi Node aaPanel ⚠ lalu ulangi |

### B. Akses repo private dengan *deploy key* hanya-baca (sekali)

Jangan memakai password atau token yang ditaruh di URL `git`.

```bash
ssh-keygen -t ed25519 -C "deploy-wisuda" -f ~/.ssh/wisuda_deploy -N ""
cat ~/.ssh/wisuda_deploy.pub        # hanya kunci PUBLIK ini yang boleh disalin
```

1. Di GitHub: repo → *Settings → Deploy keys → Add deploy key* → tempel kunci publik, **jangan centang "Allow write access"**.
   (Butuh hak admin repo — pemilik akun `aqmalazza`.)
2. Tambahkan ke `~/.ssh/config`:
   ```
   Host github-wisuda
     HostName github.com
     User git
     IdentityFile ~/.ssh/wisuda_deploy
     IdentitiesOnly yes
   ```
3. `chmod 600 ~/.ssh/wisuda_deploy ~/.ssh/config` lalu uji: `ssh -T git@github-wisuda` (pesan "successfully authenticated" = berhasil).

**Kunci privat (`wisuda_deploy`) tidak pernah dibagikan ke siapa pun, termasuk Claude.**

### C. Instalasi pertama

```bash
cd /www/wwwroot                                  # ⚠ sesuaikan dengan pola direktori aaPanel Anda
git clone git@github-wisuda:aqmalazza/WISUDA_UNINUS_2026.git wisuda
cd wisuda
git checkout <TAG_ATAU_BRANCH>                   # staging: boleh feat/r1-nextjs; produksi: hanya tag dari main
npm ci
npm run build                                    # harus selesai tanpa error
```

Jalankan sebagai proses terkelola dan **hanya mendengarkan di localhost** (jangan membuka port 3000 ke publik di firewall):

- ⚠ **Opsi 1 — Node project aaPanel:** *Website → Node project → Add*; direktori = folder `wisuda`; perintah start
  `npx next start -H 127.0.0.1 -p 3000`; pilih Node 24. Nama menu dapat berbeda.
- **Opsi 2 — PM2** (bila terpasang): `pm2 start "npx next start -H 127.0.0.1 -p 3000" --name wisuda-r1 && pm2 save`.

Cek lokal di server: `curl -sI http://127.0.0.1:3000/ | head -3` → harus `HTTP/1.1 200 OK`.

### D. Reverse proxy & HTTPS

1. ⚠ Di aaPanel buat situs untuk domain staging, lalu aktifkan *Reverse proxy* ke `http://127.0.0.1:3000`
   (atau tempel konfigurasi manual di bawah ke blok `server`).
2. Setelah DNS mengarah ke server: terbitkan sertifikat **Let's Encrypt** dari aaPanel, aktifkan *Force HTTPS*.

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

**Khusus staging** (agar tidak terindeks mesin pencari), tambahkan di blok `server`:
`add_header X-Robots-Tag "noindex, nofollow" always;` — **hapus** baris ini pada domain produksi.

### E. Verifikasi setelah deploy

Ganti `HOST` dengan domain yang diuji:

```bash
curl -sI https://HOST/ | head -3                           # 200
curl -s  https://HOST/ | grep -o '<title>[^<]*</title>'    # Wisuda ke-70 Universitas Islam Nusantara
curl -sI https://HOST/arsip/69 | head -1                   # 200
curl -sI https://HOST/galeri69.html | grep -i -E "^HTTP|^location"   # 308 + location: /arsip/69
curl -sI https://HOST/ | grep -i "x-powered-by" || echo "OK: tidak ada x-powered-by"
```

Lalu buka di HP dan laptop; periksa tampilan, gembok HTTPS, dan tautan Survei.

### F. Memperbarui (setiap rilis berikutnya)

```bash
cd /www/wwwroot/wisuda
PREV=$(git rev-parse HEAD) ; echo "$(date -Is) dari $PREV" >> ~/deploy-wisuda.log
git fetch --tags
git checkout <TAG_BARU>
rm -rf .next.prev && cp -r .next .next.prev       # cadangan build lama
npm ci && npm run build                           # BERHENTI jika gagal: lihat Rollback
# restart proses (Node project aaPanel ⚠ / pm2 restart wisuda-r1), lalu jalankan §E
```

Ada jeda beberapa detik saat restart; dapat diterima untuk R1.

### G. Rollback aplikasi

```bash
cd /www/wwwroot/wisuda
git checkout <PREV>                               # hash dari ~/deploy-wisuda.log
rm -rf .next && mv .next.prev .next               # bila build baru gagal / rusak
npm ci                                            # samakan dependensi dengan versi lama
# restart proses, lalu jalankan §E
```

Bila `.next.prev` tidak ada, ganti dengan `npm run build` pada commit lama.

### H. Yang tidak boleh

- Menaruh `.env`, kunci privat, atau token di repo, di chat, atau di dokumen.
- Membuka port 3000 langsung ke internet.
- Menjalankan `git push` dari server (deploy key hanya-baca) atau mengedit kode langsung di server.
- Menghapus server lama atau record DNS lama sebelum masa cadangan selesai (§3).

CI/CD (GitHub Actions → SSH deploy key) diusulkan untuk R2 — memerlukan ADR tersendiri.

## 3. Pemindahan domain — Keputusan D5 ([ADR-0002](adr/0002-pemindahan-domain-tanpa-menghapus-server-lama.md))

| # | Langkah | Kapan | Status |
|---|---|---|---|
| 1 | Backup lengkap situs ke-69 dari server lama (semua HTML, gambar, aset) + daftar seluruh link eksternal (Google Drive, Wasabi, survei) | Sebelum perubahan apa pun | ☐ |
| 2 | Buat subdomain staging di DNS → arahkan ke server aaPanel → pasang SSL | 15–16 Okt (usulan) | ☐ |
| 3 | Deploy & uji situs baru di staging (§2.C–E) | 22 Okt (usulan) | ☐ |
| 4 | Turunkan TTL record DNS `wisuda` (mis. 300 detik) | 1–2 hari sebelum launching | ☐ |
| 5 | Tambahkan domain `wisuda.uninus.ac.id` di aaPanel | Hari launching | ☐ |
| 6 | **Ubah record DNS** `wisuda` ke IP server aaPanel (bukan menghapus server lama) | Hari launching, dengan persetujuan | ☐ |
| 7 | Terbitkan SSL Let's Encrypt di aaPanel setelah DNS mengarah; verifikasi HTTPS | Hari launching | ☐ |
| 8 | Verifikasi (§2.E): halaman utama, `/arsip/69`, redirect `/galeri69.html` → 308 | Hari launching | ☐ |
| 9 | Server lama **tetap hidup minimal 2 minggu** sebagai cadangan | Sampai ± 2 minggu setelah launching | ☐ |
| 10 | Kembalikan TTL ke nilai normal; nonaktifkan server lama hanya setelah persetujuan | Setelah masa cadangan | ☐ |

**Rollback domain:** kembalikan record DNS `wisuda` ke IP server lama. Dengan TTL rendah, efeknya dalam hitungan menit.

**Catatan SSL:** sertifikat Let's Encrypt via HTTP challenge baru dapat diterbitkan setelah DNS mengarah ke aaPanel, sehingga ada jeda singkat. Lakukan di jam sepi trafik.
