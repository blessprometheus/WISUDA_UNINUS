#!/usr/bin/env bash
# Melengkapi .env.local produksi: rahasia acak + pengaturan dasar. Dijalankan SEKALI sebagai akun aplikasi (wisuda), setelah setup-db.sh.
# Rahasia dibuat di sini dan TIDAK ditampilkan. Hanya menambah variabel yang belum ada; tidak menimpa apa pun.
#
#   bash scripts/server/setup-env.sh                  # situs saja (tanpa QR, tanpa halaman staf)
#   STAFF=1 bash scripts/server/setup-env.sh          # + buka /masuk dan /pemindai
# Opsional: APP_ORIGIN=https://wisuda.uninus.ac.id  ENV_FILE=/www/wwwroot/wisuda/.env.local  NODE_BIN=/home/wisuda/node/bin/node

set -euo pipefail
ENV_FILE="${ENV_FILE:-/www/wwwroot/wisuda/.env.local}"
APP_ORIGIN="${APP_ORIGIN:-https://wisuda.uninus.ac.id}"
NODE_BIN="${NODE_BIN:-$(command -v node || echo /home/wisuda/node/bin/node)}"

[ -f "$ENV_FILE" ] || { echo "$ENV_FILE belum ada. Jalankan setup-db.sh dulu." >&2; exit 1; }
[[ "$APP_ORIGIN" =~ ^https://[a-z0-9.-]+$ ]] || { echo "APP_ORIGIN produksi harus https://domain tanpa path." >&2; exit 1; }
grep -q '^DATABASE_URL=' "$ENV_FILE" || { echo "DATABASE_URL belum ada di $ENV_FILE." >&2; exit 1; }

rand() { "$NODE_BIN" -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'; }
added=()
add() { # add NAMA NILAI
  if grep -q "^$1=" "$ENV_FILE"; then return 0; fi
  printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"; added+=("$1")
}

umask 177
add NODE_ENV production
add APP_ORIGIN "$APP_ORIGIN"
add TRUST_PROXY 1
add SESSION_SECRET "$(rand)"
add DOWNLOAD_SECRET "$(rand)"
add AUDIT_SECRET "$(rand)"
add TOTP_ENCRYPTION_KEY "$(rand)"
[ "${STAFF:-0}" = "1" ] && add NEXT_PUBLIC_STAFF_ENABLED 1
chmod 600 "$ENV_FILE"

echo "Variabel ditambahkan: ${added[*]:-(tidak ada, semua sudah ada)}"
echo "Nilai rahasia tidak ditampilkan. CADANGKAN TOTP_ENCRYPTION_KEY di password manager (hilang = 2FA semua akun tidak bisa dipakai):"
echo "  grep '^TOTP_ENCRYPTION_KEY=' $ENV_FILE"
