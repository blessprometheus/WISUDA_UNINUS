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
import { api, uploadEvidence, type Role } from "@/lib/api";

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
  /** Divisi yang boleh diubah pemakai ini (koordinator yang ditugaskan, atau superadmin). */
  mine: boolean;
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
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  overdue: boolean;
  note_count: number;
  evidence_count: number;
}
interface EvidenceItem {
  id: number;
  filename: string;
  mime: string;
  size_bytes: number;
  created_at: string;
  uploaded_by: string;
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

interface TaskForm {
  title: string;
  status: Status;
  start: string;
  end: string;
  description: string;
}

const EMPTY_FORM: TaskForm = { title: "", status: "belum", start: "", end: "", description: "" };

/** Pesan galat form (null = valid). Server tetap memeriksa ulang. */
function formProblem(form: TaskForm): string | null {
  if (!form.title.trim()) return "Judul pekerjaan wajib diisi.";
  if (form.start && form.end && form.end < form.start) {
    return "Tanggal selesai tidak boleh sebelum tanggal mulai.";
  }
  return null;
}

function dateLabel(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function periodLabel(start: string | null, end: string | null): string {
  if (start && end) return `${dateLabel(start)} – ${dateLabel(end)}`;
  if (end) return `s.d. ${dateLabel(end)}`;
  if (start) return `mulai ${dateLabel(start)}`;
  return "—";
}

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Kolom isian pekerjaan yang dipakai bersama oleh form tambah dan form ubah. */
function TaskFields({ value, onChange }: { value: TaskForm; onChange: (next: TaskForm) => void }) {
  const set = <K extends keyof TaskForm>(key: K, next: TaskForm[K]) =>
    onChange({ ...value, [key]: next });
  return (
    <>
      <div className="sm:col-span-2">
        <Field label="Judul pekerjaan">
          <input
            required
            maxLength={200}
            value={value.title}
            onChange={(e) => set("title", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Status pekerjaan">
        <select
          value={value.status}
          onChange={(e) => set("status", e.target.value as Status)}
          className={inputClass}
        >
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-3 sm:col-span-4 sm:grid-cols-2">
        <Field label="Tanggal mulai">
          <input
            type="date"
            value={value.start}
            onChange={(e) => set("start", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Tanggal selesai">
          <input
            type="date"
            value={value.end}
            onChange={(e) => set("end", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="sm:col-span-4">
        <Field label="Deskripsi">
          <textarea
            rows={3}
            maxLength={2000}
            value={value.description}
            onChange={(e) => set("description", e.target.value)}
            className={`${inputClass} py-2`}
          />
        </Field>
      </div>
    </>
  );
}

function payload(form: TaskForm) {
  return {
    title: form.title.trim(),
    status: form.status,
    start_date: form.start || null,
    end_date: form.end || null,
    description: form.description.trim() || null,
  };
}

function Evidence({
  taskId,
  canWrite,
  onChanged,
}: {
  taskId: number;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const list = useLoad<EvidenceItem[]>(`/api/v1/timeline/tasks/${taskId}/evidence`);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    const res = await uploadEvidence(taskId, file);
    setBusy(false);
    if (!res.ok) return setError(res.message ?? "Gagal mengunggah bukti.");
    setFile(null);
    setError(null);
    (event.target as HTMLFormElement).reset();
    list.reload();
    onChanged();
  };

  const remove = async (item: EvidenceItem) => {
    if (!window.confirm(`Hapus bukti "${item.filename}"?`)) return;
    const res = await api("POST", `/api/v1/timeline/evidence/${item.id}/delete`);
    if (!res.ok) return setError(res.message ?? "Gagal menghapus bukti.");
    setError(null);
    list.reload();
    onChanged();
  };

  return (
    <div className="grid gap-3 bg-mist-bg/60 p-4">
      {canWrite && (
        <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Tambah bukti">
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={`${inputClass} py-2`}
            />
          </Field>
          <button type="submit" disabled={!file || busy} className={btnPrimary}>
            {busy ? "Mengunggah…" : "Unggah"}
          </button>
          <p className="text-[13px] text-ink-muted sm:col-span-2">
            JPG, PNG, WebP, atau PDF; maksimal 5 MB per berkas dan 5 berkas per pekerjaan.
          </p>
        </form>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      {list.loading && <p>Memuat…</p>}
      {list.data?.length === 0 && <p className="text-[14px] text-ink-muted">Belum ada bukti.</p>}
      <ul className="grid gap-2">
        {list.data?.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-forest-900/10 bg-white p-3"
          >
            <div className="min-w-0">
              <a
                href={`/api/v1/timeline/evidence/${item.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-semibold underline underline-offset-2"
              >
                {item.filename}
              </a>
              <p className="text-[12px] text-ink-muted">
                {sizeLabel(item.size_bytes)} · {item.uploaded_by} · {when(item.created_at)}
              </p>
            </div>
            {canWrite && (
              <button type="button" className={btnGhost} onClick={() => remove(item)}>
                Hapus
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TaskRow({
  task,
  canWrite,
  canReadNotes,
  onChanged,
}: {
  task: Task;
  canWrite: boolean;
  /** Isi catatan dan bukti hanya untuk divisinya sendiri (koordinator), atau semua divisi (ketua, superadmin). */
  canReadNotes: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState<"notes" | "evidence" | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TaskForm>({
    title: task.title,
    status: task.status,
    start: task.start_date ?? "",
    end: task.end_date ?? "",
    description: task.description ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const problem = formProblem(form);
    if (problem) return setError(problem);
    const res = await api("PUT", `/api/v1/timeline/tasks/${task.id}`, payload(form));
    if (!res.ok) return setError(res.message ?? "Gagal menyimpan.");
    setEditing(false);
    setError(null);
    onChanged();
  };

  const toggle = (panel: "notes" | "evidence") => setOpen((v) => (v === panel ? null : panel));

  return (
    <>
      <tr className={task.overdue ? "bg-[#fdecea]/60" : ""}>
        <Td>
          <strong>{task.title}</strong>
          {task.description && (
            <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[13px] text-ink-muted">
              {task.description}
            </p>
          )}
        </Td>
        <Td>
          <Badge tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</Badge>
        </Td>
        <Td className="whitespace-nowrap">
          {periodLabel(task.start_date, task.end_date)}{" "}
          {task.overdue && <Badge tone="red">terlambat</Badge>}
        </Td>
        <Td>
          <span className="flex flex-wrap items-center gap-2">
            {canReadNotes ? (
              <>
                <button type="button" className={btnGhost} onClick={() => toggle("notes")}>
                  Catatan ({task.note_count})
                </button>
                <button type="button" className={btnGhost} onClick={() => toggle("evidence")}>
                  Bukti ({task.evidence_count})
                </button>
              </>
            ) : (
              <span className="text-[13px] text-ink-muted">
                {task.note_count} catatan · {task.evidence_count} bukti
              </span>
            )}
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
              <TaskFields value={form} onChange={setForm} />
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
      {open === "notes" && (
        <tr>
          <td colSpan={4} className="p-0">
            <Notes taskId={task.id} canWrite={canWrite} onChanged={onChanged} />
          </td>
        </tr>
      )}
      {open === "evidence" && (
        <tr>
          <td colSpan={4} className="p-0">
            <Evidence taskId={task.id} canWrite={canWrite} onChanged={onChanged} />
          </td>
        </tr>
      )}
    </>
  );
}

function Tasks({ role, initialDivision }: { role: Role; initialDivision: number | null }) {
  const divisions = useLoad<Division[]>("/api/v1/timeline/divisions");
  const [chosen, setChosen] = useState<number | null>(initialDivision);
  // Bawaan: divisi milik pemakai bila ada (koordinator), selain itu yang pertama.
  const divisionId =
    chosen ??
    divisions.data?.find((d) => d.mine && role === "koordinator")?.id ??
    divisions.data?.[0]?.id ??
    null;
  const current = divisions.data?.find((d) => d.id === divisionId) ?? null;
  // Server tetap menegakkan ini: koordinator hanya menulis di divisinya; ketua tidak menulis.
  const canWrite = role !== "ketua" && (current?.mine ?? false);
  const canReadNotes = role !== "koordinator" || (current?.mine ?? false);
  const tasks = useLoad<Task[]>(
    divisionId ? `/api/v1/timeline/tasks?division_id=${divisionId}` : null,
  );

  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const problem = formProblem(form);
    if (problem) return setError(problem);
    setBusy(true);
    setWarning(null);
    const res = await api<{ id: number }>("POST", "/api/v1/timeline/tasks", {
      division_id: divisionId,
      ...payload(form),
    });
    if (!res.ok || !res.data) {
      setBusy(false);
      return setError(res.message ?? "Gagal menambah pekerjaan.");
    }
    // Bukti bersifat opsional. Bila unggahannya gagal, pekerjaan tetap tersimpan dan bukti bisa ditambah dari barisnya.
    if (file) {
      const uploaded = await uploadEvidence(res.data.id, file);
      if (!uploaded.ok) {
        setWarning(
          `Pekerjaan tersimpan, tetapi bukti belum terunggah: ${uploaded.message ?? "gagal"}. Tambahkan lagi lewat tombol "Bukti" pada pekerjaan itu.`,
        );
      }
    }
    setBusy(false);
    setForm(EMPTY_FORM);
    setFile(null);
    setFileKey((k) => k + 1);
    setError(null);
    tasks.reload();
    divisions.reload();
  };

  // Hanya pada pemuatan pertama. Pemuatan ulang (setelah menyimpan) tidak boleh membongkar daftar: panel catatan/bukti
  // yang sedang terbuka dan pesan di form akan hilang.
  if (divisions.loading && !divisions.data) return <p>Memuat…</p>;
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
                {d.name}
                {d.mine && role === "koordinator" ? " (divisi Anda)" : ""} ({d.selesai}/{d.total}{" "}
                selesai)
              </option>
            ))}
          </select>
        </Field>
        {!canWrite && (
          <Badge tone="gray">
            {role === "koordinator" ? "Hanya lihat (divisi lain)" : "Hanya lihat"}
          </Badge>
        )}
      </div>

      {canWrite && divisionId && (
        <Card title="Tambah pekerjaan">
          <form onSubmit={add} className="grid gap-3 sm:grid-cols-4">
            <TaskFields value={form} onChange={setForm} />
            <div className="sm:col-span-4">
              <Field label="Upload bukti (opsional)">
                <input
                  key={fileKey}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className={`${inputClass} py-2`}
                />
              </Field>
              <p className="mt-1 text-[13px] text-ink-muted">
                JPG, PNG, WebP, atau PDF; maksimal 5 MB. Bukti lain dapat ditambahkan nanti
                (maksimal 5 berkas per pekerjaan).
              </p>
            </div>
            <div className="sm:col-span-4">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? "Menyimpan…" : "Tambah"}
              </button>
            </div>
            {error && (
              <div className="sm:col-span-4">
                <Notice kind="error">{error}</Notice>
              </div>
            )}
            {warning && (
              <div className="sm:col-span-4">
                <Notice kind="info">{warning}</Notice>
              </div>
            )}
          </form>
        </Card>
      )}

      <Card title="Daftar pekerjaan">
        {tasks.error && <Notice kind="error">{tasks.error}</Notice>}
        {tasks.loading && <p>Memuat…</p>}
        {tasks.data && (
          <Table head={["Pekerjaan", "Status", "Periode", "Aksi"]}>
            {tasks.data.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                canWrite={canWrite}
                canReadNotes={canReadNotes}
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

function ReportView({ role, onOpen }: { role: Role; onOpen: (divisionId: number) => void }) {
  const report = useLoad<Report>("/api/v1/timeline/report");
  const d = report.data;
  if (report.loading) return <p>Memuat…</p>;
  if (report.error) return <Notice kind="error">{report.error}</Notice>;
  if (!d) return null;
  return (
    <div className="grid gap-6">
      {role === "koordinator" && (
        <Notice kind="info">
          Beranda ini menampilkan progres <strong>semua divisi</strong>. Anda hanya dapat mengubah
          pekerjaan di divisi Anda sendiri; divisi lain hanya dapat dilihat.
        </Notice>
      )}
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
          <Card
            key={v.id}
            title={role === "koordinator" && v.mine ? `${v.name} · divisi Anda` : v.name}
          >
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
      <Card
        title={
          role === "koordinator"
            ? "Catatan progres terbaru (divisi Anda)"
            : "Catatan progres terbaru"
        }
      >
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
  // Beranda (laporan progres semua divisi) dapat dilihat semua peran timeline, termasuk koordinator (D46).
  const [tab, setTab] = useState<"laporan" | "pekerjaan">("laporan");
  const [division, setDivision] = useState<number | null>(null);

  return (
    <div className="grid gap-6">
      <div role="tablist" aria-label="Tampilan timeline" className="flex gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "laporan"}
          onClick={() => setTab("laporan")}
          className={tab === "laporan" ? btnPrimary : btnGhost}
        >
          Beranda · progres semua divisi
        </button>
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
          role={role}
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
