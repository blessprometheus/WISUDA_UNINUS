"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { MiniBars } from "@/components/admin/charts";
import {
  IconArrowRight,
  IconAward,
  IconCalendar,
  IconGraduation,
  IconQrCode,
  IconSearch,
  IconShirt,
  IconUsers,
} from "@/components/admin/icons";
import { SessionPicker, useSessions } from "@/components/admin/SessionPicker";
import { Badge, Notice, useLoad } from "@/components/admin/ui";

interface Stats {
  session: { id: number; name: string; event_date: string };
  total_students: number;
  present_count: number;
  absent_count: number;
  manual_count: number;
  outside_window_count: number;
  unregistered_pending: number;
  by_study_program: Array<{ study_program: string; total: number; present: number }>;
  scans_per_10min: Array<{ at: string; count: number }>;
}

interface StudentSummary {
  total: number;
  paid: number;
  yudisium: number;
  eligible: number;
  registered: number;
  blocked: number;
  unregistered_eligible: number;
  avg_gpa: string | null;
  by_gender: {
    laki_laki: number;
    perempuan: number;
  };
  by_toga: Array<{ ukuran: string; jumlah: number }>;
  by_angkatan: Array<{
    angkatan: number;
    total_kandidat: number;
    terdaftar: number;
    laki_laki: number;
    perempuan: number;
  }>;
  by_prodi: Array<{
    study_program: string;
    jenjang: string;
    total_kandidat: number;
    layak: number;
    terdaftar: number;
    belum_daftar: number;
    laki_laki: number;
    perempuan: number;
    rata_ipk: string | null;
  }>;
  recent_registrants: Array<{
    id: number;
    nim: string;
    name: string;
    study_program: string;
    gender: string | null;
    toga_size: string | null;
    gpa: string | null;
    registered_at: string | null;
  }>;
}

interface TimelineReport {
  totals: { total: number; selesai: number; terlambat: number };
  divisions: Array<{
    id: number;
    name: string;
    total: number;
    selesai: number;
    terlambat: number;
    tenggat_terdekat: string | null;
  }>;
}

const REFRESH_MS = 10_000;
const STALE_MS = 30_000;

const timeOf = (ms: number) =>
  new Date(ms).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour12: false });

function LiveStatus({ updatedAt, now }: { updatedAt: number | null; now: number }) {
  if (updatedAt === null) return null;
  const stale = now - updatedAt > STALE_MS;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold ${
        stale
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-emerald-200 bg-emerald-50 text-[#006837]"
      }`}
      role="status"
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        {!stale && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            stale ? "bg-amber-500" : "bg-[#006837]"
          }`}
        />
      </span>
      {stale
        ? `Data mungkin usang (terakhir ${timeOf(updatedAt)} WIB)`
        : `Live · Diperbarui ${timeOf(updatedAt)} WIB`}
    </span>
  );
}

export function Overview() {
  const {
    sessions,
    session,
    sessionId,
    setSessionId,
    loading: loadingSessions,
    error: sessionsError,
  } = useSessions();

  const stats = useLoad<Stats>(
    sessionId ? `/api/v1/admin/dashboard/stats?session_id=${sessionId}` : null,
  );
  const summary = useLoad<StudentSummary>("/api/v1/admin/students/summary");
  const timeline = useLoad<TimelineReport>("/api/v1/timeline/report");

  const [prodiSearch, setProdiSearch] = useState("");
  const [jenjangFilter, setJenjangFilter] = useState("ALL");

  const { reload: reloadStats } = stats;
  const { reload: reloadSummary } = summary;
  useEffect(() => {
    const timer = setInterval(() => {
      if (sessionId) reloadStats();
      reloadSummary();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [sessionId, reloadStats, reloadSummary]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);

  const d = stats.data;
  const s = summary.data;
  const tl = timeline.data;

  const totalKandidat = s?.total ?? d?.total_students ?? 0;
  const totalTerdaftar = s?.registered ?? 0;
  const totalLayak = s?.eligible ?? 0;
  const totalBelumDaftar = s?.unregistered_eligible ?? 0;
  const totalTerblokir = s?.blocked ?? 0;
  const persenTerdaftar =
    totalKandidat > 0 ? Math.round((totalTerdaftar / totalKandidat) * 100) : 0;

  const hadirProsesi = d?.present_count ?? 0;
  const viaQr = d ? Math.max(0, d.present_count - d.manual_count) : 0;
  const persenHadir =
    d && d.total_students > 0 ? Math.round((d.present_count / d.total_students) * 100) : 0;

  const lakiLaki = s?.by_gender.laki_laki ?? 0;
  const perempuan = s?.by_gender.perempuan ?? 0;
  const totalGender = lakiLaki + perempuan;
  const persenLaki = totalGender > 0 ? Math.round((lakiLaki / totalGender) * 100) : 0;
  const persenPerempuan = totalGender > 0 ? Math.round((perempuan / totalGender) * 100) : 0;

  // Gabungkan data kehadiran per prodi dari sesi aktif dengan data pendaftaran per prodi
  const presentByProdiMap = useMemo(() => {
    const map = new Map<string, { present: number; total: number }>();
    for (const row of d?.by_study_program ?? []) {
      map.set(row.study_program, { present: row.present, total: row.total });
    }
    return map;
  }, [d]);

  const byProdi = useMemo(() => {
    return (s?.by_prodi ?? []).map((p) => {
      const att = presentByProdiMap.get(p.study_program);
      return {
        ...p,
        hadir: att?.present ?? 0,
      };
    });
  }, [s, presentByProdiMap]);

  const byJenjang = useMemo(() => {
    const groups = new Map<string, { jenjang: string; kandidat: number; terdaftar: number }>();
    for (const j of ["S1", "S2", "S3"]) {
      groups.set(j, { jenjang: j, kandidat: 0, terdaftar: 0 });
    }
    for (const p of byProdi) {
      const cur = groups.get(p.jenjang) ?? { jenjang: p.jenjang, kandidat: 0, terdaftar: 0 };
      cur.kandidat += p.total_kandidat;
      cur.terdaftar += p.terdaftar;
      groups.set(p.jenjang, cur);
    }
    return Array.from(groups.values());
  }, [byProdi]);

  const filteredProdi = useMemo(() => {
    return byProdi.filter((pr) => {
      const matchJenjang = jenjangFilter === "ALL" || pr.jenjang === jenjangFilter;
      const matchSearch =
        !prodiSearch.trim() || pr.study_program.toLowerCase().includes(prodiSearch.toLowerCase());
      return matchJenjang && matchSearch;
    });
  }, [byProdi, jenjangFilter, prodiSearch]);

  const statCards = [
    {
      label: "Total Kandidat (Data Awalan)",
      value: totalKandidat,
      sub: `${totalBelumDaftar} layak belum daftar • ${totalTerblokir} belum memenuhi syarat`,
      icon: IconUsers,
      color: "from-slate-800 to-slate-900 text-white",
      badgeColor: "text-slate-300",
    },
    {
      label: "Wisudawan Terdaftar Form",
      value: totalTerdaftar,
      sub: `${persenTerdaftar}% telah isi form • ${totalLayak} layak daftar`,
      icon: IconGraduation,
      color: "from-[#004220] to-[#006837] text-white",
      badgeColor: "text-[#f4c430]",
    },
    {
      label: "Lunas & Lulus Yudisium",
      value: totalLayak,
      sub: `Lunas: ${s?.paid ?? 0} • Yudisium: ${s?.yudisium ?? 0} • IPK: ${s?.avg_gpa ?? "—"}`,
      icon: IconAward,
      color: "from-emerald-600 to-teal-700 text-white",
      badgeColor: "text-emerald-200",
    },
    {
      label: "Rekap Ukuran Baju Toga",
      value: (s?.by_toga ?? []).reduce((acc, item) => acc + item.jumlah, 0),
      sub: "Ukuran M s/d XXXXL terdata dari form",
      icon: IconShirt,
      color: "from-amber-500 to-amber-600 text-slate-950",
      badgeColor: "text-slate-900",
    },
    {
      label: "Hadir Prosesi / Sesi Aktif",
      value: hadirProsesi,
      sub: `Scan QR: ${viaQr} • Manual: ${d?.manual_count ?? 0} (${persenHadir}% hadir)`,
      icon: IconQrCode,
      color: "from-blue-600 to-indigo-700 text-white",
      badgeColor: "text-blue-200",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Top Bar: Session Filter & Live Status */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-2xs sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#006837]">
              Pusat Komando & Statistik Real-Time
            </span>
            <LiveStatus updatedAt={stats.updatedAt ?? summary.updatedAt} now={now} />
          </div>
          <h1 className="mt-1 text-lg font-extrabold text-slate-900 sm:text-xl">
            Ringkasan Eksekutif Pendaftaran, Kelayakan & Kehadiran Wisuda
          </h1>
          {session && (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>Sesi Dipantau:</span>
              <strong className="font-extrabold text-slate-900">{session.name}</strong>
              {session.is_active ? (
                <Badge tone="green">Sesi Aktif</Badge>
              ) : (
                <Badge tone="gray">Tidak Aktif</Badge>
              )}
              {session.is_active &&
                (session.window_open ? (
                  <Badge tone="green">Jam Scan QR: Buka</Badge>
                ) : (
                  <Badge tone="gold">Jam Scan QR: Tutup (Manual)</Badge>
                ))}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <SessionPicker sessions={sessions} value={sessionId} onChange={setSessionId} />
        </div>
      </div>

      {sessionsError && <Notice kind="error">{sessionsError}</Notice>}
      {!loadingSessions && sessions.length === 0 && (
        <Notice kind="info">
          Belum ada sesi kehadiran. Buat sesi gladi/hari-H di menu{" "}
          <Link href="/admin/sesi" className="font-extrabold underline">
            Sesi Kehadiran
          </Link>
          , lalu impor data wisudawan di{" "}
          <Link href="/admin/impor" className="font-extrabold underline">
            Impor & Sinkronisasi
          </Link>
          .
        </Notice>
      )}
      {stats.error && <Notice kind="error">{stats.error}</Notice>}

      {/* 1. Top 5 Executive KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className={`flex flex-col justify-between rounded-3xl bg-gradient-to-br p-5 shadow-sm ${card.color}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold opacity-85">{card.label}</span>
                <Icon className={`h-5 w-5 ${card.badgeColor}`} />
              </div>
              <div className="my-3 text-3xl font-extrabold tracking-tight tabular-nums">
                {card.value}
              </div>
              <div className="text-[11px] font-medium opacity-85">{card.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Alert Entri Tidak Terdaftar / Di Luar Jam jika ada */}
      {d && (d.unregistered_pending > 0 || d.outside_window_count > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {d.unregistered_pending > 0 && (
            <div className="flex items-center justify-between rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3.5 text-xs font-bold text-amber-950">
              <span>
                Terdapat <strong>{d.unregistered_pending}</strong> entri NIM tidak terdaftar yang
                menunggu tinjauan panitia.
              </span>
              <Link
                href="/admin/kehadiran"
                className="rounded-xl bg-amber-600 px-3 py-1.5 text-white no-underline hover:bg-amber-700"
              >
                Tinjau Sekarang
              </Link>
            </div>
          )}
          {d.outside_window_count > 0 && (
            <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3.5 text-xs font-bold text-blue-950">
              <span>
                Terdapat <strong>{d.outside_window_count}</strong> presensi yang dicatat di luar jam
                sesi scan QR.
              </span>
              <Link
                href="/admin/kehadiran"
                className="rounded-xl bg-blue-700 px-3 py-1.5 text-white no-underline hover:bg-blue-800"
              >
                Lihat Rekap
              </Link>
            </div>
          )}
        </div>
      )}

      {/* 2. Row: Distribusi Program Studi + Berdasarkan Jenis Kelamin & Ukuran Toga */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Distribusi per Program Studi */}
        <div className="space-y-5 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xs lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#006837]">
                Distribusi Akademik & Kehadiran
              </span>
              <h2 className="text-lg font-extrabold text-slate-900">
                Rekapitulasi Wisudawan Berdasarkan Program Studi
              </h2>
            </div>
            <Link
              href="/admin/wisudawan"
              className="inline-flex items-center gap-1 text-xs font-extrabold text-[#006837] no-underline hover:underline"
            >
              Database Wisudawan <IconArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {byProdi.length === 0 ? (
            <p className="py-6 text-xs text-slate-500">
              Belum ada data wisudawan.{" "}
              <Link href="/admin/impor" className="font-bold text-[#006837] underline">
                Impor CSV Data Awalan
              </Link>{" "}
              terlebih dahulu.
            </p>
          ) : (
            <div className="space-y-3.5">
              {byProdi.map((pr) => {
                const pctDaftar =
                  pr.total_kandidat > 0 ? Math.round((pr.terdaftar / pr.total_kandidat) * 100) : 0;
                return (
                  <div
                    key={pr.study_program}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-emerald-300"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="rounded-lg bg-[#006837] px-2.5 py-1 text-xs font-extrabold text-white">
                          {pr.jenjang}
                        </span>
                        <div>
                          <div className="text-sm font-extrabold text-slate-900">
                            {pr.study_program}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Laki-laki: {pr.laki_laki} • Perempuan: {pr.perempuan} • Rata IPK:{" "}
                            {pr.rata_ipk ?? "—"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-extrabold text-[#006837]">
                          {pr.terdaftar}{" "}
                          <span className="text-xs font-normal text-slate-500">
                            / {pr.total_kandidat} Terdaftar
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold text-blue-700">
                          Hadir Sesi: {pr.hadir} dari {pr.total_kandidat}
                        </div>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#006837] to-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, pctDaftar)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Jenis Kelamin + Ukuran Baju Toga */}
        <div className="space-y-6 lg:col-span-5">
          {/* Berdasarkan Jenis Kelamin */}
          <div className="space-y-4 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xs">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#006837]">
                Demografi Peserta
              </span>
              <h2 className="text-lg font-extrabold text-slate-900">Berdasarkan Jenis Kelamin</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-blue-200/70 bg-blue-50/70 p-4">
                <div className="text-xs font-bold text-blue-900">Wisudawan Laki-laki</div>
                <div className="mt-1 text-3xl font-extrabold text-blue-950 tabular-nums">
                  {lakiLaki}
                </div>
                <div className="mt-1 text-xs font-semibold text-blue-700">
                  {persenLaki}% dari Terdata
                </div>
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-blue-200">
                  <div className="h-full bg-blue-600" style={{ width: `${persenLaki}%` }} />
                </div>
              </div>

              <div className="rounded-2xl border border-pink-200/70 bg-pink-50/70 p-4">
                <div className="text-xs font-bold text-pink-900">Wisudawati Perempuan</div>
                <div className="mt-1 text-3xl font-extrabold text-pink-950 tabular-nums">
                  {perempuan}
                </div>
                <div className="mt-1 text-xs font-semibold text-pink-700">
                  {persenPerempuan}% dari Terdata
                </div>
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-pink-200">
                  <div className="h-full bg-pink-600" style={{ width: `${persenPerempuan}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Berdasarkan Ukuran Baju Toga */}
          <div className="space-y-4 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#006837]">
                  Logistik Baju Toga
                </span>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Rekapitulasi Berdasarkan Ukuran Baju Toga
                </h2>
              </div>
              <IconShirt className="h-5 w-5 text-[#006837]" />
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6 lg:grid-cols-3">
              {(s?.by_toga ?? []).map((tg) => (
                <div
                  key={tg.ukuran}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-center transition hover:border-[#006837]"
                >
                  <div className="mx-auto mb-2 inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-[#004220] px-2 text-xs font-black text-[#f4c430]">
                    {tg.ukuran}
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 tabular-nums">
                    {tg.jumlah}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">Wisudawan</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Row: By Angkatan + Jenjang & Pemindaian + Ringkasan Timeline Panitia */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* By Angkatan + Chart Scan 10 Menit */}
        <div className="space-y-5 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xs lg:col-span-5">
          <div className="border-b border-slate-100 pb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#006837]">
              Tahun Masuk Mahasiswa
            </span>
            <h2 className="text-lg font-extrabold text-slate-900">
              Jumlah Wisudawan Berdasarkan Angkatan
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase">
                  <th className="py-2.5 font-extrabold">Angkatan</th>
                  <th className="py-2.5 text-right font-extrabold">Kandidat</th>
                  <th className="py-2.5 text-right font-extrabold">Terdaftar</th>
                  <th className="py-2.5 text-right font-extrabold">Laki-laki</th>
                  <th className="py-2.5 text-right font-extrabold">Perempuan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(s?.by_angkatan ?? []).map((ang) => (
                  <tr key={ang.angkatan} className="hover:bg-slate-50">
                    <td className="py-3 font-extrabold text-slate-900">Angkatan {ang.angkatan}</td>
                    <td className="py-3 text-right font-semibold text-slate-600 tabular-nums">
                      {ang.total_kandidat}
                    </td>
                    <td className="py-3 text-right font-extrabold text-[#006837] tabular-nums">
                      {ang.terdaftar}
                    </td>
                    <td className="py-3 text-right font-semibold text-slate-700 tabular-nums">
                      {ang.laki_laki}
                    </td>
                    <td className="py-3 text-right font-semibold text-slate-700 tabular-nums">
                      {ang.perempuan}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Grafik Pemindaian per 10 Menit */}
          <div className="border-t border-slate-100 pt-4">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#006837]">
              Trafik Gate Kehadiran
            </span>
            <h3 className="mb-2 text-sm font-extrabold text-slate-900">
              Pemindaian QR per 10 Menit ({session?.name || "Sesi Aktif"})
            </h3>
            {!d || d.scans_per_10min.length === 0 ? (
              <p className="text-xs text-slate-500">
                Belum ada pemindaian pada sesi ini.{" "}
                <Link href="/pemindai" className="font-bold text-[#006837] underline">
                  Buka Loket Pemindai QR
                </Link>
              </p>
            ) : (
              <MiniBars data={d.scans_per_10min} />
            )}
          </div>
        </div>

        {/* By Jenjang & Pendaftar Terbaru + Widget Timeline Kepanitiaan */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:col-span-7">
          <div className="space-y-4 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xs">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#006837]">
                Strata & Aktivitas Pendaftaran
              </span>
              <h2 className="text-base font-extrabold text-slate-900">
                Berdasarkan Jenjang & Pendaftar Terbaru
              </h2>
            </div>

            <div className="space-y-2.5">
              <div className="text-xs font-bold text-slate-500">
                Per Jenjang Pendidikan (S1 / S2 / S3):
              </div>
              <div className="grid grid-cols-3 gap-2">
                {byJenjang.map((j) => (
                  <div
                    key={j.jenjang}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 text-center"
                  >
                    <div className="text-xs font-extrabold text-[#006837]">{j.jenjang}</div>
                    <div className="mt-0.5 text-lg font-extrabold text-slate-900 tabular-nums">
                      {j.terdaftar}
                    </div>
                    <div className="text-[10px] text-slate-500">dari {j.kandidat} kandidat</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <div className="text-xs font-bold text-slate-500">Wisudawan Terdaftar Terbaru:</div>
              {(s?.recent_registrants ?? []).length === 0 ? (
                <p className="text-xs text-slate-400">Belum ada pendaftar yang mengisi formulir.</p>
              ) : (
                <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                  {(s?.recent_registrants ?? []).slice(0, 5).map((reg) => (
                    <div
                      key={reg.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-extrabold text-slate-900">{reg.name}</div>
                        <div className="truncate text-[11px] text-slate-500">
                          {reg.nim} • {reg.study_program}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-[#006837]">
                          Toga {reg.toga_size || "-"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Widget Ringkasan Kalender Timeline Panitia */}
          <div className="flex flex-col justify-between space-y-4 rounded-3xl bg-gradient-to-br from-[#002b15] to-[#004d26] p-6 text-white shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#f4c430] px-2.5 py-0.5 text-[10px] font-extrabold text-[#002b15]">
                  TIMELINE KEPANITIAAN
                </span>
                <IconCalendar className="h-5 w-5 text-[#f4c430]" />
              </div>
              <h3 className="text-lg font-extrabold">Agenda Kalender Kerja Lintas Divisi</h3>
              <p className="text-xs text-emerald-100/80">
                Monitoring kesiapan setiap divisi panitia menuju Hari-H Wisuda Ke-70 UNINUS.
              </p>
            </div>

            {tl && tl.totals.total > 0 ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-xs">
                  <div className="flex items-center justify-between font-bold">
                    <span>Progres Seluruh Divisi</span>
                    <span className="text-[#f4c430]">
                      {tl.totals.selesai} / {tl.totals.total} Selesai (
                      {Math.round((tl.totals.selesai / tl.totals.total) * 100)}%)
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-[#f4c430]"
                      style={{
                        width: `${Math.round((tl.totals.selesai / tl.totals.total) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                  {tl.divisions.slice(0, 4).map((div) => {
                    const pct = div.total > 0 ? Math.round((div.selesai / div.total) * 100) : 0;
                    return (
                      <div
                        key={div.id}
                        className="rounded-xl border border-white/15 bg-white/10 p-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-extrabold text-[#f4c430]">{div.name}</span>
                          <span className="shrink-0 text-[10px] font-bold">{pct}%</span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-emerald-100/80">
                          Selesai: {div.selesai}/{div.total} pekerjaan
                          {div.terlambat > 0 ? ` • ${div.terlambat} terlambat` : ""}
                          {div.tenggat_terdekat ? ` • Target: ${div.tenggat_terdekat}` : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-emerald-100/80">
                Belum ada agenda timeline tercatat. Kelola divisi dan jadwal pekerjaan kepanitiaan.
              </p>
            )}

            <Link
              href="/timeline"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#f4c430] px-4 py-3 text-xs font-extrabold text-[#002b15] no-underline transition hover:bg-amber-400"
            >
              Buka Kalender Timeline Panitia <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* 4. Tabel Lengkap Berdasarkan Program Studi */}
      <div className="space-y-5 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xs sm:p-8">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 md:flex-row md:items-center">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#006837]">
              Rincian Akademik Lengkap
            </span>
            <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl">
              Jumlah Wisudawan Terdaftar Berdasarkan Program Studi
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={jenjangFilter}
              onChange={(e) => setJenjangFilter(e.target.value)}
              aria-label="Filter jenjang"
              className="rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-700"
            >
              <option value="ALL">Semua Jenjang (S1/S2/S3)</option>
              <option value="S1">Program Sarjana (S1)</option>
              <option value="S2">Program Magister (S2)</option>
              <option value="S3">Program Doktor (S3)</option>
            </select>

            <div className="relative">
              <IconSearch className=" absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={prodiSearch}
                onChange={(e) => setProdiSearch(e.target.value)}
                placeholder="Cari Program Studi..."
                className="rounded-xl border border-slate-300 py-2 pl-8 pr-3.5 text-xs font-medium"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase">
                <th className="px-3 py-3 font-extrabold">Program Studi</th>
                <th className="px-3 py-3 font-extrabold">Jenjang</th>
                <th className="px-3 py-3 text-right font-extrabold">Data Awalan</th>
                <th className="px-3 py-3 text-right font-extrabold">Layak Daftar</th>
                <th className="px-3 py-3 text-right font-extrabold">Terdaftar</th>
                <th className="px-3 py-3 text-right font-extrabold">Belum Daftar</th>
                <th className="px-3 py-3 text-right font-extrabold">Laki-laki</th>
                <th className="px-3 py-3 text-right font-extrabold">Perempuan</th>
                <th className="px-3 py-3 text-right font-extrabold">Hadir Sesi</th>
                <th className="px-3 py-3 text-right font-extrabold">Rata IPK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProdi.map((pr) => (
                <tr key={pr.study_program} className="hover:bg-emerald-50/30">
                  <td className="px-3 py-3 font-extrabold text-slate-900">{pr.study_program}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-extrabold text-[#006837]">
                      {pr.jenjang}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">
                    {pr.total_kandidat}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-emerald-700 tabular-nums">
                    {pr.layak}
                  </td>
                  <td className="px-3 py-3 text-right font-extrabold text-[#006837] tabular-nums">
                    {pr.terdaftar}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-amber-700 tabular-nums">
                    {pr.belum_daftar}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-700 tabular-nums">
                    {pr.laki_laki}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-700 tabular-nums">
                    {pr.perempuan}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-blue-700 tabular-nums">
                    {pr.hadir}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-emerald-700 tabular-nums">
                    {pr.rata_ipk ?? "—"}
                  </td>
                </tr>
              ))}
              {filteredProdi.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-slate-400">
                    Tidak ada program studi yang sesuai pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
