import type { FastifyReply } from "fastify";

/** Format respons seragam: { success, data | message } (docs/API_SPEC.md). */
export function ok<T>(reply: FastifyReply, data: T, meta?: Record<string, unknown>) {
  return reply.send({ success: true, data, ...(meta ? { meta } : {}) });
}

export function fail(reply: FastifyReply, status: number, message: string) {
  return reply.code(status).send({ success: false, message });
}
