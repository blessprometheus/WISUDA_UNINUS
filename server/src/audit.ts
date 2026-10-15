import type { FastifyRequest } from "fastify";

import { ipFingerprint } from "./auth/secrets.js";
import { pool } from "./db.js";

/**
 * Catat tindakan penting. Kegagalan mencatat tidak boleh menggagalkan permintaan,
 * tetapi dilaporkan ke konsol server.
 */
export async function audit(
  request: FastifyRequest,
  userId: number | null,
  action: string,
  options: { entity?: string; entityId?: number; detail?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, detail, ip_hash)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [
        userId,
        action,
        options.entity ?? null,
        options.entityId ?? null,
        JSON.stringify(options.detail ?? {}),
        ipFingerprint(request.ip),
      ],
    );
  } catch (error) {
    console.error("Gagal menulis audit_log:", (error as Error).message);
  }
}
