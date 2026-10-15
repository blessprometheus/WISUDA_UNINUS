"use client";

import Link from "next/link";
import { useEffect } from "react";

import { SessionPicker, useSessions } from "@/components/admin/SessionPicker";
import { Badge, Card, Notice, PageTitle, Table, Td, clockOf, useLoad } from "@/components/admin/ui";

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

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "good" | "warn";
}) {
  const color =
    tone === "good" ? "text-[#0b7a3e]" : tone === "warn" ? "text-[#8a6a00]" : "text-forest-900";
  return (
    <div className="rounded-lg border border-forest-900/10 bg-white p-4 shadow-sm">
      <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-muted">{label}</p>
      <p className={`mt-1 text-4xl font-extrabold tabular-nums ${color}`}>{value}</p>
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
    const timer = setInterval(reload, 10_000);
    return () => clearInterval(timer);
  }, [sessionId, reload]);

  const d = stats.data;
  const percent =
    d && d.total_students > 0 ? Math.round((d.present_count / d.total_students) * 100) : 0;

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

      {session && (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-[15px]">
          <strong>{session.name}</strong>
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
          <span className="text-ink-muted">· diperbarui otomatis tiap 10 detik</span>
        </p>
      )}

      {stats.error && <Notice kind="error">{stats.error}</Notice>}

      {d && (
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Wisudawan aktif" value={d.total_students} />
            <Stat label={`Hadir (${percent}%)`} value={d.present_count} tone="good" />
            <Stat label="Belum hadir" value={d.absent_count} />
            <Stat
              label="Tidak terdaftar (belum ditinjau)"
              value={d.unregistered_pending}
              tone={d.unregistered_pending ? "warn" : "default"}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Dicatat manual" value={d.manual_count} />
            <Stat
              label="Di luar jam sesi"
              value={d.outside_window_count}
              tone={d.outside_window_count ? "warn" : "default"}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <Card title="Per program studi">
              <Table head={["Program studi", "Hadir", "Total", "Kemajuan"]}>
                {d.by_study_program.map((row) => {
                  const pct = row.total ? Math.round((row.present / row.total) * 100) : 0;
                  return (
                    <tr key={row.study_program}>
                      <Td>{row.study_program}</Td>
                      <Td className="tabular-nums">{row.present}</Td>
                      <Td className="tabular-nums">{row.total}</Td>
                      <Td className="min-w-[140px]">
                        <div
                          className="h-2.5 w-full rounded bg-forest-900/10"
                          role="img"
                          aria-label={`${pct} persen hadir`}
                        >
                          <div
                            className="h-2.5 rounded bg-[#0b7a3e]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </Td>
                    </tr>
                  );
                })}
                {d.by_study_program.length === 0 && (
                  <tr>
                    <Td className="text-ink-muted">Belum ada data wisudawan.</Td>
                    <Td />
                    <Td />
                    <Td />
                  </tr>
                )}
              </Table>
            </Card>

            <Card title="Pemindaian per 10 menit">
              {d.scans_per_10min.length === 0 ? (
                <p className="text-ink-muted">Belum ada pemindaian.</p>
              ) : (
                <ul className="divide-y divide-forest-900/10">
                  {[...d.scans_per_10min].reverse().map((row) => (
                    <li
                      key={row.at}
                      className="flex items-center justify-between py-2 tabular-nums"
                    >
                      <span>{clockOf(row.at)}</span>
                      <strong>{row.count}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
