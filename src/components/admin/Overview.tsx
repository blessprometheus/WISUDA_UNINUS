"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { MiniBars, ProgressBar, ProgressRing } from "@/components/admin/charts";
import { IconAlert, IconClock, IconGraduation } from "@/components/admin/icons";
import { SessionPicker, useSessions } from "@/components/admin/SessionPicker";
import { TimelineSummary } from "@/components/admin/TimelineSummary";
import { Badge, Card, Notice, PageTitle, useLoad } from "@/components/admin/ui";

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

const REFRESH_MS = 10_000;
/** Data dianggap usang bila pembaruan terakhir lebih lama dari ini (3 siklus penyegaran). */
const STALE_MS = 30_000;

const timeOf = (ms: number) =>
  new Date(ms).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour12: false });

function Kpi({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: number;
  hint?: ReactNode;
  tone?: "default" | "warn";
}) {
  const chip =
    tone === "warn" ? "bg-[#fff3c4] text-[#6b5200]" : "bg-[#e7f5ec] text-brand-green-deep";
  return (
    <div className="rounded-xl border border-forest-900/10 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-muted">{label}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${chip}`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-4xl font-extrabold leading-none tabular-nums text-forest-900">
        {value}
      </p>
      {hint && <p className="mt-2 text-[13px] text-ink-muted">{hint}</p>}
    </div>
  );
}

/** Status data langsung: hanya berlabel "langsung" bila ada pembaruan baru; selain itu ditandai usang. */
function LiveStatus({ updatedAt, now }: { updatedAt: number | null; now: number }) {
  if (updatedAt === null) return null;
  const stale = now - updatedAt > STALE_MS;
  return (
    <p
      className={`inline-flex items-center gap-2 text-[13px] ${stale ? "text-gold-soft" : "text-mist"}`}
      role="status"
    >
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        {!stale && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-gold opacity-60 motion-safe:animate-ping" />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${stale ? "bg-[#d98c00]" : "bg-gold"}`}
        />
      </span>
      {stale
        ? `Data mungkin usang (terakhir ${timeOf(updatedAt)} WIB)`
        : `Diperbarui ${timeOf(updatedAt)} WIB · otomatis tiap 10 detik`}
    </p>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" className="grid gap-6">
      <div className="h-56 rounded-2xl bg-forest-900/10 motion-safe:animate-pulse" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-forest-900/10 motion-safe:animate-pulse" />
        ))}
      </div>
      <span className="sr-only">Memuat ringkasan…</span>
    </div>
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

  // Penyegaran otomatis tiap 10 detik agar rekap hari-H terlihat langsung.
  const { reload } = stats;
  useEffect(() => {
    if (!sessionId) return;
    const timer = setInterval(reload, REFRESH_MS);
    return () => clearInterval(timer);
  }, [sessionId, reload]);

  // Waktu pembaruan terakhir yang BERHASIL datang dari useLoad; `now` berdetak agar status usang dapat muncul.
  const d = stats.data;
  const { updatedAt } = stats;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);

  const percent =
    d && d.total_students > 0 ? Math.round((d.present_count / d.total_students) * 100) : 0;
  const viaQr = d ? Math.max(0, d.present_count - d.manual_count) : 0;

  return (
    <>
      <PageTitle title="Ringkasan">
        <SessionPicker sessions={sessions} value={sessionId} onChange={setSessionId} />
      </PageTitle>

      {sessionsError && <Notice kind="error">{sessionsError}</Notice>}
      {!loadingSessions && sessions.length === 0 && (
        <Notice kind="info">
          Belum ada sesi. Buat sesi gladi/hari-H di menu{" "}
          <Link href="/admin/sesi" className="underline">
            Sesi
          </Link>
          , lalu impor data wisudawan di{" "}
          <Link href="/admin/impor" className="underline">
            Impor Data
          </Link>
          .
        </Notice>
      )}

      {stats.error && <Notice kind="error">{stats.error}</Notice>}
      {sessionId && stats.loading && !d && <Skeleton />}

      <div className="grid gap-6">
        {d && (
          <>
            <section
              aria-labelledby="judul-kehadiran"
              className="grid gap-6 rounded-2xl bg-forest-900 p-5 text-white shadow-md sm:p-7 md:grid-cols-[auto_1fr] md:items-center"
            >
              <div className="flex justify-center md:justify-start">
                <ProgressRing value={percent} label="hadir" />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-gold">
                  Kehadiran sesi
                </p>
                <h2
                  id="judul-kehadiran"
                  className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl"
                >
                  <span className="tabular-nums">{d.present_count}</span> dari{" "}
                  <span className="tabular-nums">{d.total_students}</span> wisudawan hadir
                </h2>
                {session && (
                  <p className="mt-3 flex flex-wrap items-center gap-2 text-[15px]">
                    <strong className="font-bold">{session.name}</strong>
                    {session.is_active ? (
                      <Badge tone="green">Aktif</Badge>
                    ) : (
                      <Badge tone="gray">Tidak aktif</Badge>
                    )}
                    {session.is_active &&
                      (session.window_open ? (
                        <Badge tone="green">Jam scan QR: buka</Badge>
                      ) : (
                        <Badge tone="gold">Jam scan QR: tutup (hanya manual)</Badge>
                      ))}
                  </p>
                )}
                <dl className="mt-4 grid max-w-md grid-cols-2 gap-3 text-[14px]">
                  <div className="rounded-lg bg-white/10 px-3 py-2">
                    <dt className="text-mist">Lewat pemindai QR</dt>
                    <dd className="text-xl font-extrabold tabular-nums">{viaQr}</dd>
                  </div>
                  <div className="rounded-lg bg-white/10 px-3 py-2">
                    <dt className="text-mist">Dicatat manual</dt>
                    <dd className="text-xl font-extrabold tabular-nums">{d.manual_count}</dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <LiveStatus updatedAt={updatedAt} now={now} />
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi
                icon={<IconGraduation />}
                label="Wisudawan aktif"
                value={d.total_students}
                hint={
                  d.total_students === 0 ? "Belum ada data. Impor di menu Impor Data." : undefined
                }
              />
              <Kpi icon={<IconClock />} label="Belum hadir" value={d.absent_count} />
              <Kpi
                icon={<IconAlert />}
                label="Tidak terdaftar"
                value={d.unregistered_pending}
                tone={d.unregistered_pending ? "warn" : "default"}
                hint={
                  d.unregistered_pending ? (
                    <Link href="/admin/kehadiran" className="font-semibold underline">
                      Tinjau sekarang
                    </Link>
                  ) : (
                    "Tidak ada yang menunggu ditinjau"
                  )
                }
              />
              <Kpi
                icon={<IconClock />}
                label="Di luar jam sesi"
                value={d.outside_window_count}
                tone={d.outside_window_count ? "warn" : "default"}
                hint={d.outside_window_count ? "Dicatat setelah jam scan QR" : "Semua tepat waktu"}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
              <Card title="Kehadiran per program studi">
                {d.by_study_program.length === 0 ? (
                  <p className="text-[15px] text-ink-muted">
                    Belum ada data wisudawan.{" "}
                    <Link
                      href="/admin/impor"
                      className="font-semibold underline underline-offset-2"
                    >
                      Impor data wisudawan
                    </Link>
                  </p>
                ) : (
                  <ul className="grid gap-4">
                    {d.by_study_program.map((row) => {
                      const pct = row.total ? Math.round((row.present / row.total) * 100) : 0;
                      return (
                        <li key={row.study_program} className="grid gap-1.5">
                          <div className="flex items-baseline justify-between gap-3 text-[14px]">
                            <span className="min-w-0 font-semibold">{row.study_program}</span>
                            <span className="shrink-0 tabular-nums text-ink-muted">
                              {row.present} dari {row.total}
                            </span>
                          </div>
                          <ProgressBar value={pct} label={`hadir, ${row.study_program}`} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>

              <div className="grid min-w-0 content-start gap-6">
                <Card title="Pemindaian per 10 menit">
                  {d.scans_per_10min.length === 0 ? (
                    <div className="text-[15px] text-ink-muted">
                      <p>Belum ada pemindaian.</p>
                      <p className="mt-1">
                        Diagram muncul setelah pemindaian pertama.{" "}
                        <Link
                          href="/pemindai"
                          className="font-semibold underline underline-offset-2"
                        >
                          Buka pemindai
                        </Link>
                      </p>
                    </div>
                  ) : (
                    <MiniBars data={d.scans_per_10min} />
                  )}
                </Card>
                <TimelineSummary />
              </div>
            </div>
          </>
        )}

        {!d && !(sessionId && stats.loading) && <TimelineSummary />}
      </div>
    </>
  );
}
