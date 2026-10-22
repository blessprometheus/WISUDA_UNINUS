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
| Repository | `github.com/blessprometheus/WISUDA_UNINUS` (private; dipindah dari repo `aqmalazza/WISUDA_UNINUS_2026` pada 14 Okt 2026, repo lama jadi arsip, remote lokal `friend`) | Fakta |
| Reverse proxy | Kemungkinan Nginx bawaan aaPanel | Asumsi — dicek di §2.A |
| Versi Node target | `24.x`, dikunci via `engines` di `package.json` | Keputusan |

**Prinsip (ADR-0010, merevisi D4):** langkah di bawah dapat dijalankan **pemilik proyek** atau **Claude lewat alias SSH
yang disiapkan pemilik proyek** (mis. `ssh wisuda-staging`). Claude tidak pernah menerima kunci privat, password,
atau URL panel. Staging: Claude boleh menjalankan mandiri; **produksi: butuh "go" eksplisit** untuk tag/commit tertentu.
DNS, firewall, dan pengaturan global aaPanel tetap dikerjakan pemilik proyek. Sejak D36 (19 Okt 2026), situs/reverse proxy, database, dan SSL milik proyek ini boleh dioperasikan Claude di aaPanel lewat sesi yang di-login pemilik proyek sendiri (ADR-0010).

## Status staging (15 Okt 2026)

| Langkah | Status |
|---|---|
| Akun `wisuda` (non-root, tanpa sudo) + alias SSH `wisuda-staging` | Selesai, terverifikasi |
| Node `v24.19.0` di `/home/wisuda/node` (checksum SHA-256 cocok) | Selesai |
| Deploy key hanya-baca ke `blessprometheus/WISUDA_UNINUS` | Selesai, terverifikasi |
| Layanan `wisuda-r1` (systemd) + sudoers sempit (skrip C0, dijalankan root) | Selesai, terverifikasi (`enabled`; sudo penuh ditolak) |
| Clone, `npm ci`, `npm run build` (commit `95d295a`, branch `feat/r1-nextjs`) | Selesai |
| Layanan berjalan di `127.0.0.1:3000`; `/`, `/arsip/69`, redirect `/galeri69.html` (308) | Terverifikasi lokal di server |
| Subdomain staging (DNS) → server, Nginx reverse proxy, SSL | **Menunggu pemilik proyek** (§2.D) |

Catatan dari uji pertama: skrip C0 dikirim sebagai berkas `/home/wisuda/c0-install.sh` agar root cukup menjalankan satu perintah
(menempel blok panjang ke terminal web terbukti rawan gagal). Perintah `ps -C node` tidak menampilkan proses layanan; periksa
dengan `sudo systemctl status wisuda-r1`.

## 2. Runbook R1 — D4 direvisi oleh [ADR-0010](adr/0010-deploy-oleh-claude-dengan-batasan.md)

### A. Pengecekan awal (sekali, via SSH) — tempel hasilnya ke Claude

```bash
node -v ; npm -v ; git --version ; nginx -v
df -h /www
echo "--- internet keluar dari server (kode HTTP):"
curl -sS -o /dev/null -w "npm registry: %{http_code}\n" https://registry.npmjs.org/next
curl -sS -o /dev/null -w "github:       %{http_code}\n" https://github.com
```

| Hasil | Arti | Tindakan |
|---|---|---|
| Semua `200` (github boleh `200`/`301`) dan `node -v` = `v24.x` | Build bisa dilakukan di server | Lanjut §2.B |
| Salah satu bukan `200` | Server tidak bisa mengunduh paket | **Berhenti.** Tempel hasilnya ke Claude. Build di laptop Windows **tidak** bisa langsung diunggah (biner `swc`/`sharp` berbeda OS); perlu rancangan lain. |
| `node -v` bukan 24.x | Versi Node salah | Pilih Node 24 di manajer versi Node aaPanel ⚠ lalu ulangi |

Font Plus Jakarta Sans sudah tersedia dalam repo. `npm run build` memakai webpack dan
PostCSS Tailwind yang sama dengan `npm run preview:build` di komputer.

### B. Akses repo private dengan *deploy key* hanya-baca (sekali)

Jangan memakai password atau token yang ditaruh di URL `git`.

```bash
ssh-keygen -t ed25519 -C "deploy-wisuda" -f ~/.ssh/wisuda_deploy -N ""
cat ~/.ssh/wisuda_deploy.pub        # hanya kunci PUBLIK ini yang boleh disalin
```

1. Di GitHub: repo → *Settings → Deploy keys → Add deploy key* → tempel kunci publik, **jangan centang "Allow write access"**.
   (Butuh hak admin repo — pemilik akun `blessprometheus`.)
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

### C0. Layanan systemd (sekali, oleh pemilik proyek sebagai root) — Keputusan #35: opsi A

Aplikasi berjalan sebagai layanan `wisuda-r1` milik akun `wisuda`, hidup otomatis saat boot dan restart otomatis bila crash.
Akun `wisuda` **tidak punya sudo**; aturan sempit di bawah hanya mengizinkan me-restart layanan ini.

```bash
cat > /etc/systemd/system/wisuda-r1.service <<'EOF'
[Unit]
Description=Wisuda UNINUS R1 (Next.js)
After=network.target

[Service]
Type=simple
User=wisuda
Group=wisuda
WorkingDirectory=/www/wwwroot/wisuda
Environment=NODE_ENV=production
ExecStart=/home/wisuda/node/bin/node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/sudoers.d/wisuda-r1 <<'EOF'
wisuda ALL=(root) NOPASSWD: /usr/bin/systemctl restart wisuda-r1, /usr/bin/systemctl status wisuda-r1, /usr/bin/systemctl is-active wisuda-r1
EOF
chmod 440 /etc/sudoers.d/wisuda-r1
visudo -cf /etc/sudoers.d/wisuda-r1        # harus: "parsed OK"
systemctl daemon-reload
systemctl enable wisuda-r1                 # JANGAN start dulu: aplikasi belum dibangun
```

Lihat log: `journalctl -u wisuda-r1 -n 50 --no-pager` (root) atau `sudo systemctl status wisuda-r1` (akun `wisuda`).

### C. Instalasi pertama (dijalankan sebagai akun `wisuda`)

Node dipasang di folder pribadi `wisuda` dari tarball resmi nodejs.org dengan verifikasi checksum (tanpa `curl | sh`, tanpa root):
`/home/wisuda/node/bin/node` (versi `v24.19.0`). Tambahkan `export PATH=/home/wisuda/node/bin:$PATH` di `~/.profile`.

```bash
cd /www/wwwroot/wisuda                           # folder sudah ada, dimiliki akun wisuda
git clone git@github-wisuda:blessprometheus/WISUDA_UNINUS.git .   # titik = isi folder ini
git checkout <TAG_ATAU_BRANCH>                   # staging: boleh feat/r1-nextjs; produksi: hanya tag dari main
npm ci
npm run build                                    # harus selesai tanpa error
sudo systemctl restart wisuda-r1                 # satu-satunya sudo yang diizinkan
```

Layanan hanya mendengarkan di `127.0.0.1:3000` (jangan membuka port 3000 ke publik di firewall).
Cek lokal di server: `curl -sI http://127.0.0.1:3000/ | head -3` → harus `HTTP/1.1 200 OK`.

### C1. Database PostgreSQL (R2, sekali, oleh pemilik proyek sebagai root)

Prasyarat: PostgreSQL terpasang di aaPanel ⚠ (App Store), hanya mendengarkan `127.0.0.1`.

```bash
cd /www/wwwroot/wisuda        # setelah git clone (§C)
sudo PSQL_BIN=/www/server/pgsql/bin/psql bash scripts/server/setup-db.sh   # jalur psql aaPanel ⚠ sesuaikan
```

Skrip menanyakan sandi akun admin PostgreSQL (tidak ditampilkan), membuat user `wisuda_app` (bukan superuser) sebagai pemilik
database `wisuda`, lalu menulis `DATABASE_URL` dengan sandi acak ke `.env.local` (chmod 600) tanpa menampilkannya. Skrip menolak
berjalan bila user/database sudah ada. Diuji terhadap PostgreSQL 17 lokal; **belum diuji di aaPanel** (jalur `psql` dan metode
login admin dapat berbeda). Setelah itu, sebagai akun `wisuda`: `npm run db:migrate`.

### C2. Akun awal (oleh pemilik proyek, di server)

Kata sandi **tidak pernah** dikirim lewat chat, repo, atau log; semuanya dibuat acak oleh sistem.

1. **Superadmin (satu, pemilik proyek):** `npm run admin:create -- --email EMAIL --name "NAMA" --role superadmin` (sandi acak tampil sekali di terminal).
2. **Ketua, koordinator, petugas scan:** buat berkas daftar tanpa sandi, mis. `~/akun.csv`, berformat `email,nama,peran,divisi` (divisi hanya untuk koordinator), lalu
   `npm run admin:create-accounts -- --file ~/akun.csv`. Sandi acak ditulis ke `~/akun-baru-<tanggal>.csv` (izin 600, tidak menimpa berkas lama) dan tidak ditampilkan di terminal.
   Divisi dibuat otomatis dan dihubungkan ke koordinatornya; email yang sudah ada dilewati; kegagalan membatalkan seluruh daftar.
3. Serahkan sandi ke tiap pemilik lewat jalur aman (bukan grup umum), lalu **hapus** `~/akun.csv` dan `~/akun-baru-*.csv`.
4. Sandi sementara boleh diganti dari dashboard (Pengguna → reset sandi) atau CLI `npm run admin:reset-password`. Jangan memakai pola sandi yang sama untuk banyak akun.

### D0. Port API di server aaPanel: 3011 (BUKAN 3001)

Pada deploy pertama (19 Okt 2026) port `3001` ternyata **sudah dipakai proyek lain** di server yang sama (proses node milik user `www`, bukan proyek ini) sehingga `wisuda-api` gagal start (`EADDRINUSE`).
API proyek ini dipindah ke **`127.0.0.1:3011`** lewat `API_PORT=3011` dan `API_INTERNAL_URL=http://127.0.0.1:3011` di `.env.local` (web dibangun ulang karena `API_INTERNAL_URL` dibaca saat build).
Konsekuensi: blok Nginx `location /api/` di §D wajib `proxy_pass http://127.0.0.1:3011;`. **Jangan** mengarahkan ke 3001: itu aplikasi lain dan responsnya (`/healthz`, 401) terlihat mirip. Proses di port 3001 tidak disentuh.
Sebelum memilih port baru: `ss -ltn` untuk memastikan kosong.

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
sudo systemctl restart wisuda-r1               # lalu jalankan §E
```

Ada jeda beberapa detik saat restart; dapat diterima untuk R1.

### G. Rollback aplikasi

```bash
cd /www/wwwroot/wisuda
git checkout <PREV>                               # hash dari ~/deploy-wisuda.log
rm -rf .next && mv .next.prev .next               # bila build baru gagal / rusak
npm ci                                            # samakan dependensi dengan versi lama
sudo systemctl restart wisuda-r1               # lalu jalankan §E
```

Bila `.next.prev` tidak ada, ganti dengan `npm run build` pada commit lama.

### G2. Variabel BUILD fitur R2 (penting)

`NEXT_PUBLIC_QR_ENABLED` dan `API_INTERNAL_URL` **dibaca saat `npm run build`, bukan saat `next start`**. Mengubahnya di environment
layanan tidak berpengaruh; harus build ulang. Tanpa `NEXT_PUBLIC_QR_ENABLED=1` halaman R1 tidak memuat fitur Cari NIM sama sekali
(terverifikasi: 0 kemunculan di HTML). Hanya nyalakan setelah API, database, dan data wisudawan siap (QR dibuka ± 4 Des 2026).
Bila Nginx meneruskan `/api/*` ke API langsung, `rewrites` Next.js tidak terpakai (aman dibiarkan).

Saklar lain: `NEXT_PUBLIC_STAFF_ENABLED=1` membuka halaman `/masuk` dan `/pemindai` (default mati → keduanya 404; terverifikasi).
Saklar staf dan saklar QR terpisah karena petugas perlu dicoba lebih awal daripada wisudawan.

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
