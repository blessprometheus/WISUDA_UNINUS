"use client";

import { useState } from "react";

import { Field, inputClass, useLoad } from "@/components/admin/ui";

export interface SessionRow {
  id: number;
  kind: "gladi" | "hari_h";
  name: string;
  event_date: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  window_open: boolean;
  attendance_count: number;
}

/** Memuat daftar sesi dan memilih satu (default: yang aktif, atau yang terakhir). */
export function useSessions() {
  const list = useLoad<SessionRow[]>("/api/v1/admin/attendance-sessions");
  const [chosen, setChosen] = useState<number | null>(null);
  const sessions = list.data ?? [];
  const fallback = sessions.find((s) => s.is_active)?.id ?? sessions.at(-1)?.id ?? null;
  const sessionId = chosen ?? fallback;
  const session = sessions.find((s) => s.id === sessionId) ?? null;
  return { ...list, sessions, session, sessionId, setSessionId: setChosen };
}

export function SessionPicker({
  sessions,
  value,
  onChange,
}: {
  sessions: SessionRow[];
  value: number | null;
  onChange: (id: number) => void;
}) {
  return (
    <Field label="Sesi">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${inputClass} min-w-[260px]`}
      >
        {sessions.length === 0 && <option value="">Belum ada sesi</option>}
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} — {s.event_date}
            {s.is_active ? " (aktif)" : ""}
          </option>
        ))}
      </select>
    </Field>
  );
}
