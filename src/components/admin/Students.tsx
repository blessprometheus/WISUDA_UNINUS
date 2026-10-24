"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import {
  IconCheckCircle,
  IconEye,
  IconPen,
  IconPlus,
  IconQrCode,
  IconSearch,
  IconShirt,
  IconUpload,
  IconX,
} from "@/components/admin/icons";
import {
  Badge,
  Field,
  Notice,
  Pager,
  btnGhost,
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
  qr_url: string | null;
  is_active: boolean;
  anonymized_at: string | null;
}

interface Summary {
  total: number;
  paid: number;
  yudisium: number;
  eligible: number;
  registered: number;
  blocked: number;
  unregistered_eligible: number;
  by_prodi?: Array<{ study_program: string; jenjang: string }>;
}

const TOGA_OPTIONS = ["M", "L", "XL", "XXL", "XXXL", "XXXXL"] as const;

function StudentModalForm({
  initial,
  onDone,
  onClose,
}: {
  initial?: Student | null;
  onDone: (message: string) => void;
  onClose: () => void;
}) {
  const [nim, setNim] = useState(initial?.nim ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [program, setProgram] = useState(initial?.study_program ?? "");
  const [cohort, setCohort] = useState(initial?.cohort_year ? String(initial.cohort_year) : "2022");
  const [gender, setGender] = useState(initial?.gender ?? "");
  const [togaSize, setTogaSize] = useState(initial?.toga_size ?? "");
  const [graduation, setGraduation] = useState(initial?.graduation_date_text ?? "");
  const [isPaid, setIsPaid] = useState(initial?.is_paid ?? true);
  const [isYudisium, setIsYudisium] = useState(initial?.is_yudisium ?? true);
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
      gender: gender || null,
      toga_size: togaSize || null,
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
    onDone(initial ? "Data wisudawan diperbarui." : "Wisudawan baru berhasil ditambahkan.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="my-8 w-full max-w-2xl space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#006837]">
              Database Wisudawan UNINUS
            </span>
            <h3 className="text-lg font-extrabold text-slate-900">
              {initial
                ? `Edit Data Wisudawan (${initial.nim})`
                : "Tambah Kandidat Data Awalan Baru"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
            aria-label="Tutup modal"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="NIM Wisudawan *">
              <input
                required
                maxLength={30}
                value={nim}
                onChange={(e) => setNim(e.target.value)}
                placeholder="Contoh: 20260001"
                className={inputClass}
              />
            </Field>
            <Field label="Nama Lengkap *">
              <input
                required
                maxLength={160}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama sesuai ijazah"
                className={inputClass}
              />
            </Field>
            <Field label="Program Studi *">
              <input
                required
                maxLength={160}
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                placeholder="Contoh: S1 Teknik Informatika"
                className={inputClass}
              />
            </Field>
            <Field label="Tahun Angkatan">
              <input
                inputMode="numeric"
                maxLength={4}
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
                placeholder="2022"
                className={inputClass}
              />
            </Field>
            <Field label="Jenis Kelamin">
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className={inputClass}
              >
                <option value="">— Belum Diisi —</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </Field>
            <Field label="Ukuran Baju Toga">
              <select
                value={togaSize}
                onChange={(e) => setTogaSize(e.target.value)}
                className={inputClass}
              >
                <option value="">— Belum Diisi —</option>
                {TOGA_OPTIONS.map((sz) => (
                  <option key={sz} value={sz}>
                    Ukuran {sz}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tanggal Lulus / Yudisium (Teks)">
              <input
                maxLength={40}
                value={graduation}
                onChange={(e) => setGraduation(e.target.value)}
                placeholder="Contoh: 20 Agustus 2026"
                className={inputClass}
              />
            </Field>
            <Field label="Catatan Administrasi / Keuangan">
              <input
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Kosongkan jika tidak ada kendala"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="mb-2 text-xs font-extrabold text-emerald-950">
              Syarat Kelayakan Pendaftaran Mandiri (/pendaftaran):
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-extrabold text-slate-800">
                <input
                  type="checkbox"
                  checked={isPaid}
                  onChange={(e) => setIsPaid(e.target.checked)}
                  className="h-4 w-4 accent-[#006837]"
                />
                Lunas Pembayaran Wisuda (Keuangan)
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-extrabold text-slate-800">
                <input
                  type="checkbox"
                  checked={isYudisium}
                  onChange={(e) => setIsYudisium(e.target.checked)}
                  className="h-4 w-4 accent-[#006837]"
                />
                Telah Lulus Yudisium (Akademik / Fakultas)
              </label>
            </div>
          </div>

          {error && <Notice kind="error">{error}</Notice>}

          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className={btnGhost}>
              Batal
            </button>
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy
                ? "Menyimpan..."
                : initial
                  ? "Simpan Perubahan"
                  : "Simpan ke Database Wisudawan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Students() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [prodiFilter, setProdiFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [togaFilter, setTogaFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const summary = useLoad<Summary>("/api/v1/admin/students/summary");
  const list = useLoad<Student[]>(
    `/api/v1/admin/students?page=${page}&per_page=25&search=${encodeURIComponent(search)}&filter=${encodeURIComponent(filter)}&study_program=${encodeURIComponent(prodiFilter)}&gender=${encodeURIComponent(genderFilter)}&toga_size=${encodeURIComponent(togaFilter)}`,
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
        `Status ${field === "is_paid" ? "pembayaran keuangan" : "kelulusan yudisium"} ${student.name} diperbarui.`,
      );
      refreshAll();
    } else {
      setNotice(res.message ?? "Gagal memperbarui status kelayakan.");
    }
  };

  const sData = summary.data;
  const belumLunasCount = sData ? Math.max(0, sData.total - sData.paid) : 0;
  const belumYudisiumCount = sData ? Math.max(0, sData.total - sData.yudisium) : 0;

  return (
    <div className="space-y-6">
      {/* Top Concept Banner & Action Bar (Sesuai E:\WEB\Wisuda) */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl bg-gradient-to-r from-[#002b15] via-[#004220] to-[#005c2d] p-6 text-white shadow-sm lg:flex-row lg:items-center">
        <div className="max-w-3xl space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#f4c430] px-2.5 py-0.5 text-[10px] font-extrabold text-[#002b15]">
              ALUR PENDAFTARAN & INTEGRASI SPREADSHEET KEUANGAN
            </span>
          </div>
          <h1 className="text-lg font-extrabold sm:text-xl">
            Data Awalan Kandidat → Lunas Keuangan & Yudisium → Form Pendaftaran → Kartu QR
          </h1>
          <p className="text-xs leading-relaxed text-emerald-100/85">
            Mahasiswa hanya dapat mengisi formulir pendaftaran wisuda mandiri di{" "}
            <Link href="/pendaftaran" className="font-bold text-[#f4c430] underline">
              /pendaftaran
            </Link>{" "}
            apabila NIM-nya tercatat di database ini dengan status <strong>Lunas Pembayaran</strong>{" "}
            dan <strong>Telah Yudisium</strong>. Klik langsung lencana status di tabel atau gunakan
            sinkronisasi spreadsheet untuk memperbarui massal.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setEditingStudent(null);
              setModalOpen(true);
            }}
            className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-[#f4c430] px-4 py-2.5 text-xs font-extrabold text-[#002b15] shadow-sm transition hover:bg-amber-400"
          >
            <IconPlus className="h-4 w-4" />
            Tambah Data Awalan
          </button>

          <Link
            href="/admin/impor"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-extrabold text-white no-underline transition hover:bg-white/20"
          >
            <IconUpload className="h-4 w-4 text-[#f4c430]" />
            Impor / Sinkronisasi Spreadsheet
          </Link>
        </div>
      </div>

      {notice && <Notice kind="success">{notice}</Notice>}

      {/* Quick Status Pill Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "", label: `Semua Database (${sData?.total ?? 0})` },
          {
            key: "terdaftar",
            label: `Sudah Terdaftar Form (${sData?.registered ?? 0})`,
          },
          {
            key: "belum_daftar",
            label: `Layak Daftar • Belum Isi Form (${sData?.unregistered_eligible ?? 0})`,
          },
          {
            key: "layak",
            label: `Total Layak Daftar (${sData?.eligible ?? 0})`,
          },
          {
            key: "belum_lunas",
            label: `Belum Lunas Keuangan (${belumLunasCount})`,
          },
          {
            key: "belum_yudisium",
            label: `Belum Yudisium (${belumYudisiumCount})`,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setPage(1);
              setFilter(tab.key);
            }}
            className={`cursor-pointer rounded-2xl border px-4 py-2 text-xs font-extrabold transition ${
              filter === tab.key
                ? "border-[#006837] bg-[#006837] text-white shadow-xs"
                : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Multi-Filter Bar (Sesuai E:\WEB\Wisuda) */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <form
            className="relative lg:col-span-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            <IconSearch className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (e.target.value === "") {
                  setPage(1);
                  setSearch("");
                }
              }}
              placeholder="Cari NIM, Nama Wisudawan, atau Prodi lalu tekan Enter..."
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-20 text-xs font-semibold"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg bg-[#006837] px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-[#004220]"
            >
              Cari
            </button>
          </form>

          <select
            value={prodiFilter}
            onChange={(e) => {
              setPage(1);
              setProdiFilter(e.target.value);
            }}
            aria-label="Filter Program Studi"
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-700"
          >
            <option value="">Semua Program Studi</option>
            {(sData?.by_prodi ?? []).map((p) => (
              <option key={p.study_program} value={p.study_program}>
                {p.study_program}
              </option>
            ))}
          </select>

          <select
            value={genderFilter}
            onChange={(e) => {
              setPage(1);
              setGenderFilter(e.target.value);
            }}
            aria-label="Filter Jenis Kelamin"
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-700"
          >
            <option value="">Semua Jenis Kelamin</option>
            <option value="Laki-laki">Laki-laki</option>
            <option value="Perempuan">Perempuan</option>
          </select>

          <select
            value={togaFilter}
            onChange={(e) => {
              setPage(1);
              setTogaFilter(e.target.value);
            }}
            aria-label="Filter Ukuran Toga"
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-700"
          >
            <option value="">Semua Ukuran Toga</option>
            {TOGA_OPTIONS.map((sz) => (
              <option key={sz} value={sz}>
                Ukuran Toga {sz}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Database Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xs">
        {list.error && (
          <div className="p-4">
            <Notice kind="error">{list.error}</Notice>
          </div>
        )}
        {list.loading && <p className="p-6 text-xs font-bold text-slate-500">Memuat database…</p>}

        {list.data && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase">
                  <th className="px-4 py-3.5 font-extrabold">NIM & Nama Wisudawan</th>
                  <th className="px-3 py-3.5 font-extrabold">Program Studi & Angkatan</th>
                  <th className="px-3 py-3.5 font-extrabold">Toga & Akademik</th>
                  <th className="px-3 py-3.5 font-extrabold">Syarat Kelayakan (Klik Ubah)</th>
                  <th className="px-3 py-3.5 font-extrabold">Status Pendaftaran</th>
                  <th className="px-4 py-3.5 text-right font-extrabold">Verifikasi & Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.map((row) => {
                  const isEligible = row.is_paid && row.is_yudisium;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/90">
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold text-[#006837]">{row.nim}</div>
                        <div className="text-sm font-extrabold text-slate-900">{row.name}</div>
                        {!isEligible && (
                          <div className="mt-0.5 text-[10px] font-bold text-red-600">
                            Terblokir:{" "}
                            {[
                              !row.is_paid ? "Belum Lunas Keuangan" : null,
                              !row.is_yudisium ? "Belum Yudisium" : null,
                              row.eligibility_note,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>
                        )}
                        {isEligible && row.eligibility_note && (
                          <div className="mt-0.5 text-[10px] font-semibold text-slate-500">
                            Catatan: {row.eligibility_note}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3.5">
                        <div className="font-bold text-slate-800">{row.study_program}</div>
                        <div className="mt-0.5 text-[11px] font-medium text-slate-500">
                          {row.cohort_year ? `Angkatan ${row.cohort_year}` : "Angkatan —"} •{" "}
                          {row.gender || "JK Belum Diisi"}
                        </div>
                      </td>

                      <td className="px-3 py-3.5">
                        <div className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-extrabold text-[#006837]">
                          <IconShirt className="h-3 w-3" /> Toga: {row.toga_size || "—"}
                        </div>
                        <div className="mt-1 text-[11px] font-bold text-slate-600">
                          IPK: {row.gpa || "—"} • Foto: {row.has_photo ? "Ada" : "Belum"}
                        </div>
                      </td>

                      <td className="px-3 py-3.5">
                        {!row.anonymized_at && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleEligibility(row, "is_paid", !row.is_paid)}
                              title="Klik untuk mengubah status Lunas Keuangan"
                              className="cursor-pointer"
                            >
                              {row.is_paid ? (
                                <Badge tone="green">✓ Lunas</Badge>
                              ) : (
                                <Badge tone="red">✗ Belum Lunas</Badge>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                toggleEligibility(row, "is_yudisium", !row.is_yudisium)
                              }
                              title="Klik untuk mengubah status Lulus Yudisium"
                              className="cursor-pointer"
                            >
                              {row.is_yudisium ? (
                                <Badge tone="green">✓ Yudisium</Badge>
                              ) : (
                                <Badge tone="gold">⏳ Belum Yudisium</Badge>
                              )}
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3.5">
                        {row.anonymized_at ? (
                          <Badge tone="gray">Dianonimkan</Badge>
                        ) : !row.is_active ? (
                          <Badge tone="red">Nonaktif</Badge>
                        ) : row.registration_status === "terdaftar" ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-950 uppercase">
                              <IconCheckCircle className="h-3 w-3 text-[#006837]" /> Terdaftar Form
                            </span>
                            {row.registered_at && (
                              <div className="text-[10px] text-slate-500">
                                {when(row.registered_at)}
                              </div>
                            )}
                          </div>
                        ) : isEligible ? (
                          <span className="inline-block rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-900 uppercase">
                            Data Awalan (Layak Daftar)
                          </span>
                        ) : (
                          <span className="inline-block rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[10px] font-extrabold text-red-800 uppercase">
                            Terblokir (Syarat Kurang)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {!row.anonymized_at && (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDetailStudent(row)}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-blue-50 px-2.5 py-1.5 text-[11px] font-extrabold text-blue-700 transition hover:bg-blue-100"
                              title="Lihat Rincian Formulir, Foto & Kartu QR"
                            >
                              <IconEye className="h-3.5 w-3.5" />
                              Detail & QR
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingStudent(row);
                                setModalOpen(true);
                              }}
                              className="cursor-pointer rounded-xl bg-slate-100 p-2 text-slate-700 transition hover:bg-emerald-50 hover:text-[#006837]"
                              title="Ubah Data Wisudawan"
                            >
                              <IconPen className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleActive(row)}
                              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100"
                            >
                              {row.is_active ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {list.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Tidak ada data wisudawan yang cocok dengan filter. Impor CSV atau tambah data
                      awalan baru.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 pb-4">
          <Pager meta={list.meta} onPage={setPage} />
        </div>
      </div>

      {/* MODAL DETAIL PENDAFTARAN, FOTO FORMAL & QR CODE */}
      {detailStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="my-8 w-full max-w-2xl space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#006837]">
                  Profil Lengkap & Kartu QR Wisudawan
                </span>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {detailStudent.name} ({detailStudent.nim})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailStudent(null)}
                className="cursor-pointer rounded-xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-[1fr_auto]">
              <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="font-bold text-slate-500">Program Studi & Angkatan</dt>
                  <dd className="mt-0.5 font-extrabold text-slate-900">
                    {detailStudent.study_program} (Angkatan {detailStudent.cohort_year ?? "—"})
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="font-bold text-slate-500">Status Pendaftaran</dt>
                  <dd className="mt-0.5 font-extrabold text-[#006837]">
                    {detailStudent.registration_status === "terdaftar"
                      ? `Terdaftar (${when(detailStudent.registered_at)})`
                      : "Belum Mengisi Formulir"}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="font-bold text-slate-500">Jenis Kelamin & Ukuran Toga</dt>
                  <dd className="mt-0.5 font-extrabold text-slate-900">
                    {detailStudent.gender ?? "—"} • Toga Ukuran {detailStudent.toga_size ?? "—"}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="font-bold text-slate-500">Tempat, Tanggal Lahir</dt>
                  <dd className="mt-0.5 font-extrabold text-slate-900">
                    {detailStudent.birth_place ?? "—"}, {detailStudent.birth_date ?? "—"}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="font-bold text-slate-500">No. Handphone / WhatsApp</dt>
                  <dd className="mt-0.5 font-extrabold text-slate-900">
                    {detailStudent.phone ?? "—"}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="font-bold text-slate-500">Alamat Email</dt>
                  <dd className="mt-0.5 font-extrabold text-slate-900">
                    {detailStudent.email ?? "—"}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
                  <dt className="font-bold text-slate-500">IPK & Tanggal Kelulusan Yudisium</dt>
                  <dd className="mt-0.5 font-extrabold text-slate-900">
                    IPK {detailStudent.gpa ?? "—"} • Tanggal Yudisium:{" "}
                    {detailStudent.graduation_date ?? detailStudent.graduation_date_text ?? "—"}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
                  <dt className="font-bold text-slate-500">
                    Judul Tugas Akhir / Skripsi / Tesis / Disertasi
                  </dt>
                  <dd className="mt-0.5 font-bold text-slate-900">
                    {detailStudent.thesis_title ?? "—"}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-col items-center gap-4">
                {detailStudent.has_photo ? (
                  <div className="text-center">
                    <div className="mb-1 text-[10px] font-extrabold uppercase text-slate-500">
                      Foto Formal
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/v1/admin/students/${detailStudent.id}/photo`}
                      alt={`Foto formal ${detailStudent.name}`}
                      className="h-36 w-28 rounded-2xl border border-slate-200 bg-white object-cover shadow-xs"
                    />
                  </div>
                ) : (
                  <div className="flex h-36 w-28 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-[11px] font-semibold text-slate-400">
                    Foto Formal Belum Diunggah
                  </div>
                )}

                {detailStudent.qr_url && (
                  <a
                    href={detailStudent.qr_url}
                    download
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#006837] px-3.5 py-2 text-xs font-extrabold text-white no-underline shadow-xs hover:bg-[#004220]"
                  >
                    <IconQrCode className="h-4 w-4 text-[#f4c430]" />
                    Unduh Kartu QR
                  </a>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  const row = detailStudent;
                  setDetailStudent(null);
                  setEditingStudent(row);
                  setModalOpen(true);
                }}
                className={btnGhost}
              >
                Edit Data Wisudawan
              </button>
              <button type="button" onClick={() => setDetailStudent(null)} className={btnPrimary}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADD / EDIT WISUDAWAN */}
      {modalOpen && (
        <StudentModalForm
          initial={editingStudent}
          onClose={() => {
            setModalOpen(false);
            setEditingStudent(null);
          }}
          onDone={(msg) => {
            setModalOpen(false);
            setEditingStudent(null);
            setNotice(msg);
            refreshAll();
          }}
        />
      )}
    </div>
  );
}
