#!/usr/bin/env bash
# Membuat database + user PostgreSQL untuk Wisuda UNINUS. Dijalankan SEKALI oleh pemilik proyek (root) di server.
#
# - Sandi user aplikasi dibuat acak di sini, TIDAK ditampilkan, dan hanya ditulis ke .env.local (chmod 600).
# - User aplikasi menjadi PEMILIK database ini saja (bukan superuser) sehingga migrasi dapat membuat tabel.
# - Menolak berjalan bila user atau database sudah ada (tidak menimpa apa pun).
#
# Pemakaian:
#   sudo bash scripts/server/setup-db.sh
# Variabel opsional (nilai bawaan di kanan):
#   PSQL_BIN=psql                       # aaPanel biasanya /www/server/pgsql/bin/psql
#   PGHOST=127.0.0.1  PGPORT=5432
#   PG_SUPERUSER=postgres               # akun admin PostgreSQL; sandinya ditanya bila PGPASSWORD kosong
#   DB_NAME=wisuda  DB_USER=wisuda_app
#   ENV_FILE=/www/wwwroot/wisuda/.env.local   APP_OWNER=wisuda

set -euo pipefail

PSQL_BIN="${PSQL_BIN:-psql}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PG_SUPERUSER="${PG_SUPERUSER:-postgres}"
DB_NAME="${DB_NAME:-wisuda}"
DB_USER="${DB_USER:-wisuda_app}"
ENV_FILE="${ENV_FILE:-/www/wwwroot/wisuda/.env.local}"
APP_OWNER="${APP_OWNER:-wisuda}"

# Nama hanya huruf kecil, angka, garis bawah: aman dipakai tanpa kutip di SQL.
for name in "$DB_NAME" "$DB_USER"; do
  [[ "$name" =~ ^[a-z][a-z0-9_]{1,30}$ ]] || { echo "Nama tidak valid: $name" >&2; exit 1; }
done

command -v "$PSQL_BIN" >/dev/null 2>&1 || [ -x "$PSQL_BIN" ] || {
  echo "psql tidak ditemukan. Isi PSQL_BIN, mis. PSQL_BIN=/www/server/pgsql/bin/psql" >&2
  exit 1
}

if [ -z "${PGPASSWORD:-}" ]; then
  read -r -s -p "Sandi akun admin PostgreSQL ($PG_SUPERUSER), tidak ditampilkan: " PGPASSWORD
  echo
  export PGPASSWORD
fi

psql_admin() { "$PSQL_BIN" -h "$PGHOST" -p "$PGPORT" -U "$PG_SUPERUSER" -v ON_ERROR_STOP=1 -X -q -tA "$@"; }

psql_admin -d postgres -c "SELECT 1" >/dev/null || { echo "Tidak bisa masuk ke PostgreSQL. Periksa host, port, akun, dan sandi." >&2; exit 1; }

if [ "$(psql_admin -d postgres -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'")" = "1" ]; then
  echo "User '$DB_USER' sudah ada. Tidak ada yang diubah." >&2; exit 1
fi
if [ "$(psql_admin -d postgres -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")" = "1" ]; then
  echo "Database '$DB_NAME' sudah ada. Tidak ada yang diubah." >&2; exit 1
fi
if [ -f "$ENV_FILE" ] && grep -q '^DATABASE_URL=' "$ENV_FILE"; then
  echo "$ENV_FILE sudah berisi DATABASE_URL. Hapus barisnya dulu bila ingin dibuat ulang." >&2; exit 1
fi

# Sandi acak heksadesimal (aman di URL, tanpa perlu escape).
APP_PASSWORD="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"

psql_admin -d postgres <<SQL
CREATE ROLE ${DB_USER} LOGIN PASSWORD '${APP_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER} ENCODING 'UTF8';
REVOKE ALL ON DATABASE ${DB_NAME} FROM PUBLIC;
GRANT ALL ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

umask 177
mkdir -p "$(dirname "$ENV_FILE")"
printf 'DATABASE_URL=postgres://%s:%s@127.0.0.1:%s/%s\n' "$DB_USER" "$APP_PASSWORD" "$PGPORT" "$DB_NAME" >> "$ENV_FILE"
chmod 600 "$ENV_FILE"
if id "$APP_OWNER" >/dev/null 2>&1; then chown "$APP_OWNER":"$APP_OWNER" "$ENV_FILE"; fi
unset APP_PASSWORD PGPASSWORD

echo "Selesai: database '$DB_NAME', user '$DB_USER' dibuat. DATABASE_URL ditulis ke $ENV_FILE (sandi tidak ditampilkan)."
echo "Langkah berikut (sebagai akun $APP_OWNER): npm run db:migrate"
