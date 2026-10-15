"use client";

import { useState, type FormEvent } from "react";

import {
  Badge,
  Card,
  Field,
  Notice,
  Table,
  Td,
  btnGhost,
  btnGold,
  btnPrimary,
  inputClass,
  useLoad,
  when,
} from "@/components/admin/ui";
import { api, type Role } from "@/lib/api";

type Status = "belum" | "berjalan" | "selesai" | "tertunda";

interface Division {
  id: number;
  name: string;
  total: number;
  selesai: number;
  berjalan: number;
  tertunda: number;
  belum: number;
  terlambat: number;
}
interface ReportDivision extends Division {
  tenggat_terdekat: string | null;
}
interface Report {
  totals: { total: number; selesai: number; terlambat: number };
  divisions: ReportDivision[];
  recent_notes: Array<{
    id: number;
    note: string;
    created_at: string;
    author: string;
    task_title: string;
    division: string;
  }>;
}
interface Task {
  id: number;
  title: string;
  status: Status;
  due_date: string | null;
  overdue: boolean;
  note_count: number;
}
interface Note {
  id: number;
  note: string;
  created_at: string;
  author: string;
}

const STATUS_LABEL: Record<Status, string> = {
  belum: "Belum dimulai",
  berjalan: "Berjalan",
  selesai: "Selesai",
  tertunda: "Tertunda",
};
const STATUS_TONE: Record<Status, "gray" | "gold" | "green" | "red"> = {
  belum: "gray",
  berjalan: "gold",
  selesai: "green",
  tertunda: "red",
};

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-3 flex-1 rounded bg-forest-900/10"
        role="img"
        aria-label={`${pct} persen selesai`}
      >
        <div className="h-3 rounded bg-[#0b7a3e]" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right text-[14px] font-bold tabular-nums">{pct}%</span>
    </div>
  );
}

function Notes({
  taskId,
  canWrite,
  onChanged,
}: {
  taskId: number;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const notes = useLoad<Note[]>(`/api/v1/timeline/tasks/${taskId}/notes`);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const res = await api("POST", `/api/v1/timeline/tasks/${taskId}/notes`, { note: text });
    if (!res.ok) return setError(res.message ?? "Gagal menyimpan catatan.");
    setText("");
    setError(null);
    notes.reload();
    onChanged();
  };

  return (
    <div className="grid gap-3 bg-mist-bg/60 p-4">
      {canWrite && (
        <form onSubmit={add} className="grid gap-2">
          <Field label="Catatan progres baru">
            <textarea
              required
              maxLength={2000}
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={`${inputClass} py-2`}
            />
          </Field>
          <div>
            <button type="submit" className={btnPrimary}>
              Tambah catatan
            </button>
          </div>
          {error && <Notice kind="error">{error}</Notice>}
        </form>
      )}
      {notes.loading && <p>Memuat…</p>}
      {notes.data?.length === 0 && <p className="text-[14px] text-ink-muted">Belum ada catatan.</p>}
      <ul className="grid gap-2">
        {notes.data?.map((n) => (
          <li key={n.id} className="rounded border border-forest-900/10 bg-white p-3">
            <p className="whitespace-pre-wrap text-[15px]">{n.note}</p>
            <p className="mt-1 text-[12px] text-ink-muted">
              {n.author} · {when(n.created_at)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TaskRow({
  task,
  canWrite,
  onChanged,
}: {
  task: Task;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState<Status>(task.status);
  const [due, setDue] = useState(task.due_date ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const res = await api("PUT", `/api/v1/timeline/tasks/${task.id}`, {
      title,
      status,
      due_date: due || null,
    });
    if (!res.ok) return setError(res.message ?? "Gagal menyimpan.");
    setEditing(false);
    setError(null);
    onChanged();
  };

  return (
    <>
      <tr className={task.overdue ? "bg-[#fdecea]/60" : ""}>
        <Td>
          <strong>{task.title}</strong>
        </Td>
        <Td>
          <Badge tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</Badge>
        </Td>
        <Td className="whitespace-nowrap">
          {task.due_date ?? "—"} {task.overdue && <Badge tone="red">terlambat</Badge>}
        </Td>
        <Td>
          <span className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={() => setOpen((v) => !v)}>
              Catatan ({task.note_count})
            </button>
            {canWrite && (
              <button type="button" className={btnGhost} onClick={() => setEditing((v) => !v)}>
                {editing ? "Batal" : "Ubah"}
              </button>
            )}
          </span>
        </Td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={4} className="bg-mist-bg/60 p-4">
            <form onSubmit={save} className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <Field label="Judul pekerjaan">
                  <input
                    required
                    maxLength={200}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Status">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                  className={inputClass}
                >
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tenggat">
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <div className="sm:col-span-4">
                <button type="submit" className={btnGold}>
                  Simpan
                </button>
              </div>
              {error && (
                <div className="sm:col-span-4">
                  <Notice kind="error">{error}</Notice>
                </div>
              )}
            </form>
          </td>
        </tr>
      )}
      {open && (
        <tr>
          <td colSpan={4} className="p-0">
            <Notes taskId={task.id} canWrite={canWrite} onChanged={onChanged} />
          </td>
        </tr>
      )}
    </>
  );
}

function Tasks({ role, initialDivision }: { role: Role; initialDivision: number | null }) {
  const canWrite = role !== "ketua";
  const divisions = useLoad<Division[]>("/api/v1/timeline/divisions");
  const [chosen, setChosen] = useState<number | null>(initialDivision);
  const divisionId = chosen ?? divisions.data?.[0]?.id ?? null;
  const tasks = useLoad<Task[]>(
    divisionId ? `/api/v1/timeline/tasks?division_id=${divisionId}` : null,
  );

  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [status, setStatus] = useState<Status>("belum");
  const [error, setError] = useState<string | null>(null);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const res = await api("POST", "/api/v1/timeline/tasks", {
      division_id: divisionId,
      title,
      status,
      due_date: due || null,
    });
    if (!res.ok) return setError(res.message ?? "Gagal menambah pekerjaan.");
    setTitle("");
    setDue("");
    setStatus("belum");
    setError(null);
    tasks.reload();
    divisions.reload();
  };

  if (divisions.loading) return <p>Memuat…</p>;
  if (divisions.data?.length === 0) {
    return (
      <Notice kind="info">
        {role === "koordinator"
          ? "Anda belum ditugaskan ke divisi mana pun. Hubungi superadmin."
          : "Belum ada divisi. Buat divisi di menu Dashboard → Divisi & Timeline."}
      </Notice>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Divisi">
          <select
            value={divisionId ?? ""}
            onChange={(e) => setChosen(Number(e.target.value))}
            className={`${inputClass} min-w-[260px]`}
          >
            {divisions.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.selesai}/{d.total} selesai)
              </option>
            ))}
          </select>
        </Field>
        {!canWrite && <Badge tone="gray">Hanya lihat</Badge>}
      </div>

      {canWrite && divisionId && (
        <Card title="Tambah pekerjaan">
          <form onSubmit={add} className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Field label="Judul pekerjaan">
                <input
                  required
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Status awal">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className={inputClass}
              >
                {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tenggat">
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className={inputClass}
              />
            </Field>
            <div className="sm:col-span-4">
              <button type="submit" className={btnPrimary}>
                Tambah
              </button>
            </div>
            {error && (
              <div className="sm:col-span-4">
                <Notice kind="error">{error}</Notice>
              </div>
            )}
          </form>
        </Card>
      )}

      <Card title="Daftar pekerjaan">
        {tasks.error && <Notice kind="error">{tasks.error}</Notice>}
        {tasks.loading && <p>Memuat…</p>}
        {tasks.data && (
          <Table head={["Pekerjaan", "Status", "Tenggat", "Aksi"]}>
            {tasks.data.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                canWrite={canWrite}
                onChanged={() => {
                  tasks.reload();
                  divisions.reload();
                }}
              />
            ))}
            {tasks.data.length === 0 && (
              <tr>
                <Td className="text-ink-muted">Belum ada pekerjaan.</Td>
                <Td />
                <Td />
                <Td />
              </tr>
            )}
          </Table>
        )}
      </Card>
    </div>
  );
}

function ReportView({ onOpen }: { onOpen: (divisionId: number) => void }) {
  const report = useLoad<Report>("/api/v1/timeline/report");
  const d = report.data;
  if (report.loading) return <p>Memuat…</p>;
  if (report.error) return <Notice kind="error">{report.error}</Notice>;
  if (!d) return null;
  return (
    <div className="grid gap-6">
      <Card title="Ringkasan keseluruhan">
        <Progress done={d.totals.selesai} total={d.totals.total} />
        <p className="mt-3 text-[15px]">
          <strong>{d.totals.selesai}</strong> dari <strong>{d.totals.total}</strong> pekerjaan
          selesai ·{" "}
          {d.totals.terlambat > 0 ? (
            <Badge tone="red">{d.totals.terlambat} terlambat</Badge>
          ) : (
            <Badge tone="green">tidak ada yang terlambat</Badge>
          )}
        </p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {d.divisions.map((v) => (
          <Card key={v.id} title={v.name}>
            <Progress done={v.selesai} total={v.total} />
            <p className="mt-3 flex flex-wrap gap-1.5 text-[13px]">
              <Badge tone="green">{v.selesai} selesai</Badge>
              <Badge tone="gold">{v.berjalan} berjalan</Badge>
              <Badge tone="gray">{v.belum} belum</Badge>
              {v.tertunda > 0 && <Badge tone="red">{v.tertunda} tertunda</Badge>}
              {v.terlambat > 0 && <Badge tone="red">{v.terlambat} terlambat</Badge>}
            </p>
            <p className="mt-2 text-[13px] text-ink-muted">
              Tenggat terdekat: {v.tenggat_terdekat ?? "—"}
            </p>
            <button type="button" className={`${btnGhost} mt-3`} onClick={() => onOpen(v.id)}>
              Lihat pekerjaan
            </button>
          </Card>
        ))}
        {d.divisions.length === 0 && <Notice kind="info">Belum ada divisi.</Notice>}
      </div>
      <Card title="Catatan progres terbaru">
        {d.recent_notes.length === 0 && <p className="text-ink-muted">Belum ada catatan.</p>}
        <ul className="divide-y divide-forest-900/10">
          {d.recent_notes.map((n) => (
            <li key={n.id} className="py-3">
              <p className="text-[13px] text-ink-muted">
                {n.division} · {n.task_title} · {n.author} · {when(n.created_at)}
              </p>
              <p className="whitespace-pre-wrap text-[15px]">{n.note}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function Timeline({ role }: { role: Role }) {
  const hasReport = role === "ketua" || role === "superadmin";
  const [tab, setTab] = useState<"laporan" | "pekerjaan">(hasReport ? "laporan" : "pekerjaan");
  const [division, setDivision] = useState<number | null>(null);

  return (
    <div className="grid gap-6">
      <div role="tablist" aria-label="Tampilan timeline" className="flex gap-2">
        {hasReport && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "laporan"}
            onClick={() => setTab("laporan")}
            className={tab === "laporan" ? btnPrimary : btnGhost}
          >
            Laporan progres
          </button>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={tab === "pekerjaan"}
          onClick={() => setTab("pekerjaan")}
          className={tab === "pekerjaan" ? btnPrimary : btnGhost}
        >
          Pekerjaan per divisi
        </button>
      </div>
      {tab === "laporan" ? (
        <ReportView
          onOpen={(id) => {
            setDivision(id);
            setTab("pekerjaan");
          }}
        />
      ) : (
        <Tasks key={division ?? "x"} role={role} initialDivision={division} />
      )}
    </div>
  );
}
