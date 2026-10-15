"use client";

import { useState, type FormEvent } from "react";

import { useSessions, type SessionRow } from "@/components/admin/SessionPicker";
import {
  Badge,
  Card,
  Field,
  Notice,
  PageTitle,
  Table,
  Td,
  btnGhost,
  btnGold,
  btnPrimary,
  inputClass,
  when,
} from "@/components/admin/ui";
import { api } from "@/lib/api";

/** Waktu lokal WIB "HH:MM" dari ISO. */
function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function iso(date: string, time: string): string {
  return `${date}T${time}:00+07:00`;
}

function SessionForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: SessionRow;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [kind, setKind] = useState<SessionRow["kind"]>(initial?.kind ?? "gladi");
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.event_date ?? "");
  const [start, setStart] = useState(initial ? hhmm(initial.starts_at) : "07:00");
  const [end, setEnd] = useState(initial ? hhmm(initial.ends_at) : "12:00");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = Boolean(initial && initial.attendance_count > 0);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      kind,
      name,
      event_date: date,
      starts_at: iso(date, start),
      ends_at: iso(date, end),
    };
    const res = initial
      ? await api<SessionRow>("PUT", `/api/v1/admin/attendance-sessions/${initial.id}`, body)
      : await api<SessionRow>("POST", "/api/v1/admin/attendance-sessions", body);
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? "Gagal menyimpan.");
      return;
    }
    onDone();
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Field label="Jenis">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as SessionRow["kind"])}
          disabled={locked}
          className={inputClass}
        >
          <option value="gladi">Gladi resik</option>
          <option value="hari_h">Hari-H</option>
        </select>
      </Field>
      <Field label="Nama sesi">
        <input
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="Gladi Resik"
        />
      </Field>
      <Field label="Tanggal (WIB)">
        <input
          required
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={locked}
          className={inputClass}
        />
      </Field>
      <Field label="Jam mulai scan QR">
        <input
          required
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Jam akhir scan QR">
        <input
          required
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className={inputClass}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-5">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {initial ? "Simpan perubahan" : "Buat sesi"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={btnGhost}>
            Batal
          </button>
        )}
        {locked && (
          <span className="text-[14px] text-ink-muted">
            Sudah ada kehadiran: tanggal dan jenis tidak dapat diubah, jam masih bisa.
          </span>
        )}
      </div>
      {error && (
        <div className="sm:col-span-2 lg:col-span-5">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
    </form>
  );
}

export function Sessions() {
  const { sessions, loading, error, reload } = useSessions();
  const [editing, setEditing] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const act = async (id: number, action: "activate" | "deactivate") => {
    const res = await api("POST", `/api/v1/admin/attendance-sessions/${id}/${action}`);
    setNotice(
      res.ok
        ? action === "activate"
          ? "Sesi diaktifkan; sesi lain otomatis dinonaktifkan."
          : "Sesi dinonaktifkan."
        : (res.message ?? "Gagal."),
    );
    reload();
  };

  return (
    <>
      <PageTitle title="Sesi Kehadiran" />
      <div className="grid gap-6">
        <Notice kind="info">
          Petugas hanya dapat mencatat kehadiran pada sesi yang <strong>diaktifkan</strong>. Scan QR
          dibatasi jam di bawah; input NIM manual tetap diterima di luar jam, tetapi ditandai
          &quot;di luar jam&quot;.
        </Notice>
        {notice && <Notice kind="success">{notice}</Notice>}
        {error && <Notice kind="error">{error}</Notice>}

        <Card title="Buat sesi baru">
          <SessionForm
            onDone={() => {
              setNotice("Sesi dibuat.");
              reload();
            }}
          />
        </Card>

        <Card title="Daftar sesi">
          {loading && <p>Memuat…</p>}
          {!loading && sessions.length === 0 && <p className="text-ink-muted">Belum ada sesi.</p>}
          {sessions.length > 0 && (
            <Table head={["Sesi", "Tanggal", "Jam scan QR", "Status", "Hadir", "Aksi"]}>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <Td>
                    <strong>{s.name}</strong>
                    <br />
                    <span className="text-[12px] text-ink-muted">
                      {s.kind === "gladi" ? "Gladi resik" : "Hari-H"}
                    </span>
                  </Td>
                  <Td>{s.event_date}</Td>
                  <Td className="whitespace-nowrap">
                    {hhmm(s.starts_at)}–{hhmm(s.ends_at)} WIB
                    <br />
                    <span className="text-[12px] text-ink-muted">{when(s.starts_at)}</span>
                  </Td>
                  <Td>
                    {s.is_active ? (
                      <Badge tone="green">Aktif</Badge>
                    ) : (
                      <Badge tone="gray">Tidak aktif</Badge>
                    )}{" "}
                    {s.is_active &&
                      (s.window_open ? (
                        <Badge tone="green">QR buka</Badge>
                      ) : (
                        <Badge tone="gold">QR tutup</Badge>
                      ))}
                  </Td>
                  <Td className="tabular-nums">{s.attendance_count}</Td>
                  <Td>
                    <span className="flex flex-wrap gap-2">
                      {s.is_active ? (
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => act(s.id, "deactivate")}
                        >
                          Nonaktifkan
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={btnGold}
                          onClick={() => act(s.id, "activate")}
                        >
                          Aktifkan
                        </button>
                      )}
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={() => setEditing(editing === s.id ? null : s.id)}
                      >
                        {editing === s.id ? "Tutup" : "Ubah"}
                      </button>
                    </span>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
          {editing !== null && (
            <div className="mt-6 border-t border-forest-900/10 pt-5">
              <h3 className="mb-3 font-extrabold">Ubah sesi</h3>
              {sessions
                .filter((s) => s.id === editing)
                .map((s) => (
                  <SessionForm
                    key={s.id}
                    initial={s}
                    onCancel={() => setEditing(null)}
                    onDone={() => {
                      setEditing(null);
                      setNotice("Sesi diperbarui.");
                      reload();
                    }}
                  />
                ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
