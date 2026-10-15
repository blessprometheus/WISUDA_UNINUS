import pg from "pg";

import { config } from "./config.js";

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
});

// Nilai BIGINT/BIGSERIAL kecil di proyek ini; dikembalikan sebagai number agar JSON tidak berupa string.
pg.types.setTypeParser(20, (value) => Number(value));
