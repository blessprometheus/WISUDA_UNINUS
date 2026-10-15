"use client";

import { useState, type FormEvent } from "react";

import {
  Badge,
  Card,
  Field,
  Notice,
  PageTitle,
  Pager,
  Table,
  Td,
  btnGhost,
  btnPrimary,
  inputClass,
  useLoad,
} from "@/components/admin/ui";
import { api } from "@/lib/api";

interface Student {
  id: number;
  nim: string;
  name: string;
  study_program: string;
  cohort_year: number | null;
  graduation_date_text: string | null;
  is_active: boolean;
  anonymized_at: string | null;
}

function StudentForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: Student;
  onDone: (message: string) => void;
  onCancel?: () => void;
}) {
  const [nim, setNim] = useState(initial?.nim ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [program, setProgram] = useState(initial?.study_program ?? "");
  const [cohort, setCohort] = useState(initial?.cohort_year ? String(initial.cohort_year) : "");
  const [graduation, setGraduation] = useState(initial?.graduation_date_text ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      nim,
      name,
      study_program: program,
      cohort_year: cohort || null,
      graduation_date_text: graduation || null,
    };
    const res = initial
      ? await api("PUT", `/api/v1/admin/students/${initial.id}`, body)
      : await api("POST", "/api/v1/admin/students", body);
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? "Gagal menyimpan.");
      return;
    }
    onDone(initial ? "Data wisudawan diperbarui." : "Wisudawan ditambahkan.");
    if (!initial) {
      setNim("");
      setName("");
      setProgram("");
      setCohort("");
      setGraduation("");
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Field label="NIM">
        <input
          required
          maxLength={30}
          value={nim}
          onChange={(e) => setNim(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Nama">
        <input
          required
          maxLength={160}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Program studi">
        <input
          required
          maxLength={160}
          value={program}
          onChange={(e) => setProgram(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Angkatan (opsional)">
        <input
          inputMode="numeric"
          maxLength={4}
          value={cohort}
          onChange={(e) => setCohort(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Tanggal lulus (teks, opsional)">
        <input
          maxLength={40}
          value={graduation}
          onChange={(e) => setGraduation(e.target.value)}
          className={inputClass}
        />
      </Field>
      <div className="flex gap-3 sm:col-span-2 lg:col-span-5">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {initial ? "Simpan perubahan" : "Tambah wisudawan"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={btnGhost}>
            Batal
          </button>
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

export function Students() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const list = useLoad<Student[]>(
    `/api/v1/admin/students?page=${page}&per_page=25&search=${encodeURIComponent(search)}`,
  );

  const toggle = async (student: Student) => {
    const action = student.is_active ? "deactivate" : "reactivate";
    const res = await api("POST", `/api/v1/admin/students/${student.id}/${action}`);
    setNotice(
      res.ok
        ? `${student.name} ${student.is_active ? "dinonaktifkan" : "diaktifkan kembali"}.`
        : (res.message ?? "Gagal."),
    );
    list.reload();
  };

  return (
    <>
      <PageTitle title="Wisudawan" />
      <div className="grid gap-6">
        {notice && <Notice kind="success">{notice}</Notice>}
        <Card title="Tambah satu wisudawan (susulan / koreksi)">
          <StudentForm
            onDone={(message) => {
              setNotice(message);
              list.reload();
            }}
          />
        </Card>

        <Card title="Daftar wisudawan">
          <form
            className="mb-4 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            <Field label="Cari NIM / nama / prodi">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className={`${inputClass} min-w-[260px]`}
                maxLength={100}
              />
            </Field>
            <button type="submit" className={btnPrimary}>
              Cari
            </button>
          </form>
          {list.error && <Notice kind="error">{list.error}</Notice>}
          {list.loading && <p>Memuat…</p>}
          {list.data && (
            <Table head={["NIM", "Nama", "Program studi", "Angkatan", "Status", "Aksi"]}>
              {list.data.map((s) => (
                <tr key={s.id}>
                  <Td className="whitespace-nowrap font-mono">{s.nim}</Td>
                  <Td>{s.name}</Td>
                  <Td>{s.study_program}</Td>
                  <Td>{s.cohort_year ?? "—"}</Td>
                  <Td>
                    {s.anonymized_at ? (
                      <Badge tone="gray">Dianonimkan</Badge>
                    ) : s.is_active ? (
                      <Badge tone="green">Aktif</Badge>
                    ) : (
                      <Badge tone="red">Nonaktif</Badge>
                    )}
                  </Td>
                  <Td>
                    {!s.anonymized_at && (
                      <span className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => setEditing(editing === s.id ? null : s.id)}
                        >
                          {editing === s.id ? "Tutup" : "Ubah"}
                        </button>
                        <button type="button" className={btnGhost} onClick={() => toggle(s)}>
                          {s.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
              {list.data.length === 0 && (
                <tr>
                  <Td className="text-ink-muted">Tidak ada data. Impor CSV atau tambah manual.</Td>
                  <Td />
                  <Td />
                  <Td />
                  <Td />
                  <Td />
                </tr>
              )}
            </Table>
          )}
          <Pager meta={list.meta} onPage={setPage} />
          {editing !== null &&
            list.data
              ?.filter((s) => s.id === editing)
              .map((s) => (
                <div key={s.id} className="mt-6 border-t border-forest-900/10 pt-5">
                  <h3 className="mb-3 font-extrabold">Ubah {s.name}</h3>
                  <StudentForm
                    initial={s}
                    onCancel={() => setEditing(null)}
                    onDone={(message) => {
                      setEditing(null);
                      setNotice(message);
                      list.reload();
                    }}
                  />
                </div>
              ))}
        </Card>
      </div>
    </>
  );
}
