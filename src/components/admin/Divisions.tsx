"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import {
  Card,
  Field,
  Notice,
  PageTitle,
  btnGhost,
  btnPrimary,
  inputClass,
  useLoad,
} from "@/components/admin/ui";
import { api, type Role } from "@/lib/api";

interface Member {
  id: number;
  name: string;
  email: string;
}
interface DivisionRow {
  id: number;
  name: string;
  members: Member[];
}
interface UserRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
}

function Assign({
  division,
  coordinators,
  onDone,
}: {
  division: DivisionRow;
  coordinators: UserRow[];
  onDone: (message: string) => void;
}) {
  const [userId, setUserId] = useState("");
  const taken = new Set(division.members.map((m) => m.id));
  const options = coordinators.filter((u) => !taken.has(u.id));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const res = await api("POST", `/api/v1/admin/divisions/${division.id}/members`, {
      user_id: Number(userId),
    });
    onDone(res.ok ? "Koordinator ditugaskan." : (res.message ?? "Gagal menugaskan."));
    setUserId("");
  };

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
      <Field label="Tugaskan koordinator">
        <select
          required
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className={`${inputClass} min-w-[240px]`}
        >
          <option value="">Pilih…</option>
          {options.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>
      </Field>
      <button type="submit" className={btnPrimary} disabled={!userId}>
        Tugaskan
      </button>
    </form>
  );
}

export function Divisions() {
  const divisions = useLoad<DivisionRow[]>("/api/v1/admin/divisions");
  const users = useLoad<UserRow[]>("/api/v1/admin/users");
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const coordinators = (users.data ?? []).filter((u) => u.role === "koordinator" && u.is_active);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const res = await api("POST", "/api/v1/admin/divisions", { name });
    setNotice(
      res.ok
        ? { kind: "success", text: "Divisi dibuat." }
        : { kind: "error", text: res.message ?? "Gagal." },
    );
    if (res.ok) setName("");
    divisions.reload();
  };

  const remove = async (divisionId: number, member: Member) => {
    if (!window.confirm(`Cabut ${member.name} dari divisi ini?`)) return;
    const res = await api(
      "POST",
      `/api/v1/admin/divisions/${divisionId}/members/${member.id}/remove`,
    );
    setNotice(
      res.ok
        ? { kind: "success", text: "Penugasan dicabut." }
        : { kind: "error", text: res.message ?? "Gagal." },
    );
    divisions.reload();
  };

  return (
    <>
      <PageTitle title="Divisi & Timeline">
        <Link href="/timeline" className={btnGhost}>
          Buka timeline ↗
        </Link>
      </PageTitle>
      <div className="grid gap-6">
        <Notice kind="info">
          Satu divisi dapat dipegang <strong>beberapa koordinator</strong>. Koordinator dapat
          melihat progres semua divisi, tetapi hanya mengubah pekerjaan di divisinya; ketua hanya
          melihat. Akun berperan koordinator dibuat di menu{" "}
          <Link href="/admin/pengguna" className="underline">
            Pengguna
          </Link>
          .
        </Notice>
        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        <Card title="Buat divisi">
          <form onSubmit={create} className="flex flex-wrap items-end gap-3">
            <Field label="Nama divisi">
              <input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`${inputClass} min-w-[260px]`}
              />
            </Field>
            <button type="submit" className={btnPrimary}>
              Buat divisi
            </button>
          </form>
        </Card>

        {divisions.loading && <p>Memuat…</p>}
        {divisions.data?.length === 0 && <Notice kind="info">Belum ada divisi.</Notice>}
        <div className="grid gap-4 lg:grid-cols-2">
          {divisions.data?.map((d) => (
            <Card key={d.id} title={d.name}>
              {d.members.length === 0 ? (
                <p className="text-[14px] text-ink-muted">Belum ada koordinator.</p>
              ) : (
                <ul className="divide-y divide-forest-900/10">
                  {d.members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        {m.name} <span className="text-[13px] text-ink-muted">{m.email}</span>
                      </span>
                      <button type="button" className={btnGhost} onClick={() => remove(d.id, m)}>
                        Cabut
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Assign
                division={d}
                coordinators={coordinators}
                onDone={(text) => {
                  setNotice({ kind: text.includes("ditugaskan") ? "success" : "error", text });
                  divisions.reload();
                }}
              />
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
