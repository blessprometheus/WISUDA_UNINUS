"use client";

import Link from "next/link";
import { useState } from "react";

import { IconExternalLink, IconQrCode, IconScan } from "@/components/admin/icons";
import { SessionPicker, useSessions } from "@/components/admin/SessionPicker";
import {
  Badge,
  Card,
  Notice,
  Pager,
  Table,
  Td,
  btnGhost,
  btnGold,
  useLoad,
  when,
} from "@/components/admin/ui";
import { api } from "@/lib/api";

interface Row {
  id: number;
  nim: string;
  name: string;
  study_program: string;
  scanned_at: string;
  method: "qr" | "manual";
  outside_window: boolean;
  device_label: string | null;
  recorded_by: string;
}
interface Unregistered {
  id: number;
  typed_nim: string;
  typed_name: string | null;
  created_at: string;
  reviewed_at: string | null;
  entered_by: string;
}
interface Stats {
  total_students: number;
  present_count: number;
  absent_count: number;
  manual_count: number;
  outside_window_count: number;
  unregistered_pending: number;
}

export function Attendances() {
  const { sessions, session, sessionId, setSessionId } = useSessions();
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const stats = useLoad<Stats>(
    sessionId ? `/api/v1/admin/dashboard/stats?session_id=${sessionId}` : null,
  );
  const rows = useLoad<Row[]>(
    sessionId ? `/api/v1/admin/attendances?session_id=${sessionId}&page=${page}&per_page=50` : null,
  );
  const unregistered = useLoad<Unregistered[]>(
    sessionId ? `/api/v1/admin/unregistered?session_id=${sessionId}` : null,
  );

  const review = async (id: number) => {
    const res = await api("POST", `/api/v1/admin/unregistered/${id}/review`);
    setNotice(res.ok ? "Ditandai sudah ditinjau." : (res.message ?? "Gagal."));
    unregistered.reload();
    stats.reload();
  };

  const st = stats.data;
  const viaQr = st ? Math.max(0, st.present_count - st.manual_count) : 0;

  return (
    <div className="space-y-6">
      {/* Top Action & Session Bar */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-2xs md:flex-row md:items-center">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#006837]">
            Data Center Presensi & Gate Hari-H
          </span>
          <h1 className="text-lg font-extrabold text-slate-900 sm:text-xl">
            Rekapitulasi Kehadiran — {session?.name || "Pilih Sesi"}
          </h1>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <SessionPicker
            sessions={sessions}
            value={sessionId}
            onChange={(id) => {
              setSessionId(id);
              setPage(1);
            }}
          />
          <Link
            href="/pemindai"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#006837] px-4 py-2.5 text-xs font-extrabold text-white no-underline shadow-xs hover:bg-[#004220]"
          >
            <IconScan className="h-4 w-4 text-[#f4c430]" />
            <span>Buka Loket Pemindai QR</span>
          </Link>
          <Link
            href="/#unduh-qr"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-amber-100 px-3.5 py-2.5 text-xs font-extrabold text-amber-950 no-underline hover:bg-amber-200"
          >
            <IconQrCode className="h-4 w-4" />
            <span>Laman Unduh QR</span>
            <IconExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Summary KPI Bar (Sesuai Presensi\Index.jsx E:\WEB\Wisuda) */}
      {st && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-bold text-slate-500">Total Wisudawan Aktif</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">
              {st.total_students}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-xs font-bold text-emerald-800">Hadir Scan QR</div>
            <div className="mt-1 text-2xl font-extrabold text-[#006837] tabular-nums">{viaQr}</div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-xs font-bold text-blue-800">Total Hadir Sesi</div>
            <div className="mt-1 text-2xl font-extrabold text-blue-700 tabular-nums">
              {st.present_count}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs font-bold text-amber-800">Dicatat Manual / Di Luar Jam</div>
            <div className="mt-1 text-2xl font-extrabold text-amber-700 tabular-nums">
              {st.manual_count} / {st.outside_window_count}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4">
            <div className="text-xs font-bold text-slate-600">Belum Check-In</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-800 tabular-nums">
              {st.absent_count}
            </div>
          </div>
        </div>
      )}

      {notice && <Notice kind="success">{notice}</Notice>}

      <Card
        eyebrow="Log Aktivitas Scanner Real-Time"
        title="Daftar Kehadiran Tercatat pada Sesi Ini"
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {sessionId ? (
            <a
              href={`/api/v1/admin/attendances/export?session_id=${sessionId}`}
              download
              className={btnGold}
            >
              Unduh Rekap CSV (Semua Wisudawan, Hadir & Belum)
            </a>
          ) : null}
          <button
            type="button"
            className={btnGhost}
            onClick={() => {
              rows.reload();
              stats.reload();
            }}
          >
            Segarkan Data
          </button>
        </div>
        {rows.error && <Notice kind="error">{rows.error}</Notice>}
        {rows.loading && <p className="text-xs text-slate-500">Memuat…</p>}
        {rows.data && (
          <Table
            head={[
              "Waktu Scan",
              "NIM",
              "Nama Wisudawan",
              "Program Studi",
              "Metode",
              "Petugas",
              "Titik / Meja",
            ]}
          >
            {rows.data.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <Td className="font-mono whitespace-nowrap text-slate-600">{when(r.scanned_at)}</Td>
                <Td className="font-mono font-bold text-[#006837]">{r.nim}</Td>
                <Td className="font-extrabold text-slate-900">{r.name}</Td>
                <Td className="font-semibold text-slate-700">{r.study_program}</Td>
                <Td>
                  {r.method === "qr" ? (
                    <Badge tone="green">Scan QR</Badge>
                  ) : (
                    <Badge tone="gold">Manual</Badge>
                  )}{" "}
                  {r.outside_window && <Badge tone="red">Di luar jam</Badge>}
                </Td>
                <Td className="text-slate-700">{r.recorded_by}</Td>
                <Td className="text-slate-500">{r.device_label ?? "—"}</Td>
              </tr>
            ))}
            {rows.data.length === 0 && (
              <tr>
                <Td className="text-slate-400">Belum ada kehadiran tercatat pada sesi ini.</Td>
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
        <Pager meta={rows.meta} onPage={setPage} />
      </Card>

      <Card
        eyebrow="Verifikasi Lapangan"
        title="Entri “Tidak Terdaftar” (Tidak Dihitung Hadir)"
        subtitle="NIM yang diketik petugas di lapangan tetapi tidak ditemukan di database wisudawan. Tinjau dan perbaiki data wisudawan bila sah."
      >
        {unregistered.data && (
          <Table head={["Waktu", "NIM Diketik", "Nama Diketik", "Petugas", "Status Tinjauan"]}>
            {unregistered.data.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <Td className="font-mono whitespace-nowrap text-slate-600">{when(u.created_at)}</Td>
                <Td className="font-mono font-bold text-red-700">{u.typed_nim}</Td>
                <Td className="font-semibold text-slate-800">{u.typed_name ?? "—"}</Td>
                <Td>{u.entered_by}</Td>
                <Td>
                  {u.reviewed_at ? (
                    <Badge tone="gray">Sudah Ditinjau</Badge>
                  ) : (
                    <button type="button" className={btnGhost} onClick={() => review(u.id)}>
                      Tandai Ditinjau
                    </button>
                  )}
                </Td>
              </tr>
            ))}
            {unregistered.data.length === 0 && (
              <tr>
                <Td className="text-slate-400">Tidak ada entri tidak terdaftar.</Td>
                <Td />
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
