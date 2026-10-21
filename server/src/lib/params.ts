import type { FastifyRequest } from "fastify";

import { pool } from "../db.js";

export function positiveId(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function query(request: FastifyRequest): Record<string, unknown> {
  return (request.query ?? {}) as Record<string, unknown>;
}

export function params(request: FastifyRequest): Record<string, unknown> {
  return (request.params ?? {}) as Record<string, unknown>;
}

export function body(request: FastifyRequest): Record<string, unknown> {
  const value = request.body;
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function str(value: unknown, max: number): string {
  return typeof value === "string" && value.length <= max ? value.trim() : "";
}

export interface Page {
  page: number;
  perPage: number;
  offset: number;
}

export function pagination(q: Record<string, unknown>, defaultSize = 50, maxSize = 200): Page {
  const page = positiveId(q.page) ?? 1;
  const perPage = Math.min(maxSize, positiveId(q.per_page) ?? defaultSize);
  return { page, perPage, offset: (page - 1) * perPage };
}

export function pageMeta(page: Page, total: number) {
  return {
    page: page.page,
    per_page: page.perPage,
    total,
    last_page: Math.max(1, Math.ceil(total / page.perPage)),
  };
}

let cachedCeremonyId: number | null = null;

/** Penyelenggaraan aktif = nomor tertinggi (saat ini Wisuda ke-70). */
export async function currentCeremonyId(): Promise<number> {
  if (cachedCeremonyId !== null) return cachedCeremonyId;
  const result = await pool.query<{ id: number }>(
    "SELECT id FROM ceremonies ORDER BY number DESC LIMIT 1",
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error("Belum ada penyelenggaraan (tabel ceremonies kosong).");
  cachedCeremonyId = id;
  return id;
}
