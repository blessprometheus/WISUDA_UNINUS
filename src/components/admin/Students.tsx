"use client";

import Link from "next/link";
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
  btnGold,
  btnPrimary,
  inputClass,
  useLoad,
  when,
} from "@/components/admin/ui";
import { api } from "@/lib/api";

interface Student {
  id: number;
  nim: string;
  name: string;
  study_program: string;
  cohort_year: number | null;
  graduation_date_text: string | null;
  is_paid: boolean;
  is_yudisium: boolean;
  eligibility_note: string | null;
  registration_status: "belum_daftar" | "terdaftar";
  registered_at: string | null;
  gender: string | null;
  toga_size: string | null;
  birth_place: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  gpa: string | null;
  graduation_date: string | null;
  thesis_title: string | null;
  has_photo: boolean;
  is_active: boolean;
  anonymized_at: string | null;
}

interface Summary {
  total: number;
  paid: number;
  yudisium: number;
  eligible: number;
  registered: number;
}

const FILTERS = [
  { value: "", label: "Semua Peserta" },
  { value: "layak", label: "Layak Daftar (Lunas & Yudisium)" },
  { value: "belum_lunas", label: "Belum Lunas Keuangan" },
  { value: "belum_yudisium", label: "Belum Yudisium" },
  { value: "terdaftar", label: "Sudah Isi Form Pendaftaran" },
  { value: "belum_daftar", label: "Layak tetapi Belum Daftar" },
] as const;

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
  const [isPaid, setIsPaid] = useState(initial?.is_paid ?? false);
  const [isYudisium, setIsYudisium] = useState(initial?.is_yudisium ?? false);
  const [note, setNote] = useState(initial?.eligibility_note ?? "");
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
      is_paid: isPaid,
      is_yudisium: isYudisium,
      eligibility_note: note || null,
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
      setIsPaid(false);
      setIsYudisium(false);
      setNote("");
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="NIM">
        <input
          required
          maxLength={30}
          value={nim}
          onChange={(e) => setNim(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Nama Lengkap">
        <input
          required
          maxLength={160}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Program Studi">
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
      <Field label="Tanggal Lulus (teks, opsional)">
        <input
          maxLength={40}
          value={graduation}
          onChange={(e) => setGraduation(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Catatan Administrasi / Keuangan (opsional)">
        <input
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Contoh: Kurang bebas pustaka / tunggakan..."
          className={inputClass}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-5 pt-4 sm:col-span-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[14px] font-bold text-forest-900">
          <input
            type="checkbox"
            checked={isPaid}
            onChange={(e) => setIsPaid(e.target.checked)}
            className="h-4 w-4 accent-brand-green-deep"
          />
          Lunas Pembayaran (Keuangan)
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[14px] font-bold text-forest-900">
          <input
            type="checkbox"
            checked={isYudisium}
            onChange={(e) => setIsYudisium(e.target.checked)}
            className="h-4 w-4 accent-brand-green-deep"
          />
          Telah Lulus Yudisium (Akademik)
        </label>
      </div>
      <div className="flex gap-3 sm:col-span-2 lg:col-span-4">
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
        <div className="sm:col-span-2 lg:col-span-4">
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
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const summary = useLoad<Summary>("/api/v1/admin/students/summary");
  const list = useLoad<Student[]>(
    `/api/v1/admin/students?page=${page}&per_page=25&search=${encodeURIComponent(search)}&filter=${encodeURIComponent(filter)}`,
  );

  const refreshAll = () => {
    list.reload();
    summary.reload();
  };

  const toggleActive = async (student: Student) => {
    const action = student.is_active ? "deactivate" : "reactivate";
    const res = await api("POST", `/api/v1/admin/students/${student.id}/${action}`);
    setNotice(
      res.ok
        ? `${student.name} ${student.is_active ? "dinonaktifkan" : "diaktifkan kembali"}.`
        : (res.message ?? "Gagal."),
    );
    refreshAll();
  };

  const toggleEligibility = async (
    student: Student,
    field: "is_paid" | "is_yudisium",
    value: boolean,
  ) => {
    const res = await api("POST", `/api/v1/admin/students/${student.id}/eligibility`, {
      [field]: value,
    });
    if (res.ok) {
      setNotice(
        `Status ${field === "is_paid" ? "pembayaran" : "yudisium"} ${student.name} diperbarui.`,
      );
      refreshAll();
    } else {
      setNotice(res.message ?? "Gagal memperbarui status kelayakan.");
    }
  };

  const sData = summary.data;

  return (
    <>
      <PageTitle title="Database Peserta Wisudawan">
        <Link href="/admin/impor" className={btnGold}>
          Sinkronisasi Spreadsheet Keuangan / CSV →
        </Link>
      </PageTitle>

      <div className="grid gap-6">
        {notice && <Notice kind="success">{notice}</Notice>}

        {/* Ringkasan Statistik Kelayakan & Pendaftaran */}
        {sData && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-forest-900/10 bg-white p-4 shadow-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Total Peserta
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-forest-900">
                {sData.total}
              </p>
            </div>
            <div className="rounded-xl border border-forest-900/10 bg-white p-4 shadow-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Lunas Keuangan
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-brand-green-deep">
                {sData.paid}
              </p>
            </div>
            <div className="rounded-xl border border-forest-900/10 bg-white p-4 shadow-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Telah Yudisium
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-brand-green-deep">
                {sData.yudisium}
              </p>
            </div>
            <div className="rounded-xl border border-forest-900/10 bg-white p-4 shadow-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Layak Daftar
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-forest-900">
                {sData.eligible}
              </p>
            </div>
            <div className="col-span-2 rounded-xl border border-forest-900/10 bg-forest-900 p-4 text-white shadow-xs sm:col-span-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gold">
                Sudah Daftar Form
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums">{sData.registered}</p>
            </div>
          </div>
        )}

        <Card title="Tambah peserta wisudawan (susulan / koreksi)">
          <StudentForm
            onDone={(message) => {
              setNotice(message);
              refreshAll();
            }}
          />
        </Card>

        <Card title="Daftar peserta & status kelayakan pendaftaran">
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
                className={`${inputClass} min-w-[240px]`}
                maxLength={100}
              />
            </Field>
            <Field label="Filter Status">
              <select
                value={filter}
                onChange={(e) => {
                  setPage(1);
                  setFilter(e.target.value);
                }}
                className={inputClass}
              >
                {FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
            <button type="submit" className={btnPrimary}>
              Terapkan
            </button>
          </form>

          {list.error && <Notice kind="error">{list.error}</Notice>}
          {list.loading && <p>Memuat…</p>}
          {list.data && (
            <Table
              head={[
                "NIM",
                "Nama & Prodi",
                "Keuangan (Bayar)",
                "Yudisium",
                "Form Pendaftaran",
                "Status Akun",
                "Aksi",
              ]}
            >
              {list.data.map((s) => (
                <tr key={s.id}>
                  <Td className="whitespace-nowrap font-mono font-bold">{s.nim}</Td>
                  <Td>
                    <p className="font-bold text-forest-900">{s.name}</p>
                    <p className="text-xs text-ink-muted">
                      {s.study_program} {s.cohort_year ? `· Angkatan ${s.cohort_year}` : ""}
                    </p>
                    {s.eligibility_note && (
                      <p className="mt-1 text-xs font-semibold text-[#7a1712]">
                        Catatan: {s.eligibility_note}
                      </p>
                    )}
                  </Td>
                  <Td>
                    {!s.anonymized_at && (
                      <button
                        type="button"
                        onClick={() => toggleEligibility(s, "is_paid", !s.is_paid)}
                        title="Klik untuk mengubah status pembayaran"
                        className="cursor-pointer"
                      >
                        {s.is_paid ? (
                          <Badge tone="green">✓ Lunas</Badge>
                        ) : (
                          <Badge tone="red">✗ Belum Lunas</Badge>
                        )}
                      </button>
                    )}
                  </Td>
                  <Td>
                    {!s.anonymized_at && (
                      <button
                        type="button"
                        onClick={() => toggleEligibility(s, "is_yudisium", !s.is_yudisium)}
                        title="Klik untuk mengubah status yudisium"
                        className="cursor-pointer"
                      >
                        {s.is_yudisium ? (
                          <Badge tone="green">✓ Sudah Yudisium</Badge>
                        ) : (
                          <Badge tone="gold">⏳ Belum Yudisium</Badge>
                        )}
                      </button>
                    )}
                  </Td>
                  <Td>
                    {s.registration_status === "terdaftar" ? (
                      <div className="flex flex-col items-start gap-1">
                        <Badge tone="green">Terdaftar</Badge>
                        {s.toga_size && (
                          <span className="text-xs font-semibold text-ink-muted">
                            Toga: {s.toga_size} · IPK: {s.gpa ?? "—"}
                          </span>
                        )}
                      </div>
                    ) : s.is_paid && s.is_yudisium ? (
                      <Badge tone="gold">Layak (Belum Isi Form)</Badge>
                    ) : (
                      <Badge tone="gray">Belum Memenuhi Syarat</Badge>
                    )}
                  </Td>
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
                        {s.registration_status === "terdaftar" && (
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => setDetailId(detailId === s.id ? null : s.id)}
                          >
                            {detailId === s.id ? "Tutup Detail" : "Data Form"}
                          </button>
                        )}
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => setEditing(editing === s.id ? null : s.id)}
                        >
                          {editing === s.id ? "Tutup" : "Ubah"}
                        </button>
                        <button type="button" className={btnGhost} onClick={() => toggleActive(s)}>
                          {s.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
              {list.data.length === 0 && (
                <tr>
                  <Td className="text-ink-muted">
                    Tidak ada data yang cocok. Impor CSV atau tambah manual.
                  </Td>
                  <Td />
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

          {/* Panel Detail Isian Formulir Pendaftaran Wisudawan */}
          {detailId !== null &&
            list.data
              ?.filter((s) => s.id === detailId)
              .map((s) => (
                <div
                  key={s.id}
                  className="mt-6 rounded-xl border border-forest-900/15 bg-mist-bg p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-extrabold text-forest-900">
                      Detail Pendaftaran: {s.name} ({s.nim})
                    </h3>
                    <button type="button" onClick={() => setDetailId(null)} className={btnGhost}>
                      Tutup
                    </button>
                  </div>
                  <div className="grid gap-6 md:grid-cols-[1fr_auto]">
                    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="font-semibold text-ink-muted">Waktu Pendaftaran</dt>
                        <dd className="font-bold">{when(s.registered_at)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink-muted">Jenis Kelamin</dt>
                        <dd className="font-bold">{s.gender ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink-muted">Ukuran Baju Toga</dt>
                        <dd className="font-bold">{s.toga_size ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink-muted">Tempat, Tanggal Lahir</dt>
                        <dd className="font-bold">
                          {s.birth_place ?? "—"}, {s.birth_date ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink-muted">No. HP / WhatsApp</dt>
                        <dd className="font-bold">{s.phone ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink-muted">Email</dt>
                        <dd className="font-bold">{s.email ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink-muted">IPK & Tanggal Yudisium</dt>
                        <dd className="font-bold">
                          IPK {s.gpa ?? "—"} · Lulus {s.graduation_date ?? "—"}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="font-semibold text-ink-muted">
                          Judul Tugas Akhir / Skripsi / Tesis / Disertasi
                        </dt>
                        <dd className="font-bold">{s.thesis_title ?? "—"}</dd>
                      </div>
                    </dl>
                    {s.has_photo && (
                      <div className="flex flex-col items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/v1/admin/students/${s.id}/photo`}
                          alt={`Foto formal ${s.name}`}
                          className="h-36 w-28 rounded-lg border border-forest-900/20 bg-white object-cover"
                        />
                        <a
                          href={`/api/v1/admin/students/${s.id}/photo`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-bold underline"
                        >
                          Buka Foto Penuh
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}

          {/* Form Edit Wisudawan */}
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
                      refreshAll();
                    }}
                  />
                </div>
              ))}
        </Card>
      </div>
    </>
  );
}
