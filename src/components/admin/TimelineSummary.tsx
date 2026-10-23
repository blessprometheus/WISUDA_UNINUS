"use client";

import Link from "next/link";

import { IconArrowRight } from "@/components/admin/icons";
import { ProgressBar } from "@/components/admin/charts";
import { Badge, Card, useLoad } from "@/components/admin/ui";

interface Report {
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

const pct = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

/** Ringkasan progres timeline panitia di beranda dashboard: yang perlu perhatian lebih dulu. */
export function TimelineSummary() {
  const report = useLoad<Report>("/api/v1/timeline/report");
  const d = report.data;

  const attention = d
    ? [...d.divisions]
        .filter((v) => v.total > 0)
        .sort(
          (a, b) => b.terlambat - a.terlambat || pct(a.selesai, a.total) - pct(b.selesai, b.total),
        )
        .slice(0, 5)
    : [];

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold text-forest-900">Progres timeline panitia</h2>
        <Link
          href="/timeline"
          className="inline-flex min-h-11 items-center gap-1.5 rounded px-2 text-[14px] font-bold text-brand-green-deep no-underline transition-colors duration-150 hover:bg-forest-900/5"
        >
          Buka timeline <IconArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {report.loading && !d && (
        <div aria-busy="true" className="grid gap-3">
          <div className="h-3 rounded-full bg-forest-900/10 motion-safe:animate-pulse" />
          <div className="h-3 w-2/3 rounded-full bg-forest-900/10 motion-safe:animate-pulse" />
          <span className="sr-only">Memuat progres timeline…</span>
        </div>
      )}
      {report.error && <p className="text-[15px] text-[#7a1712]">{report.error}</p>}

      {d && d.totals.total === 0 && (
        <p className="text-[15px] text-ink-muted">
          Belum ada pekerjaan. Koordinator mengisinya dari halaman{" "}
          <Link href="/timeline" className="font-semibold underline underline-offset-2">
            Timeline
          </Link>
          ; progresnya akan tampil di sini.
        </p>
      )}

      {d && d.totals.total > 0 && (
        <div className="grid gap-5">
          <div>
            <ProgressBar value={pct(d.totals.selesai, d.totals.total)} label="pekerjaan selesai" />
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[14px]">
              <strong>{d.totals.selesai}</strong> dari <strong>{d.totals.total}</strong> pekerjaan
              selesai
              {d.totals.terlambat > 0 ? (
                <Badge tone="red">{d.totals.terlambat} terlambat</Badge>
              ) : (
                <Badge tone="green">tidak ada yang terlambat</Badge>
              )}
            </p>
          </div>
          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-ink-muted">
              Perlu perhatian
            </p>
            <ul className="grid gap-3">
              {attention.map((v) => (
                <li key={v.id} className="grid gap-1">
                  <div className="flex items-center justify-between gap-2 text-[14px]">
                    <span className="min-w-0 truncate font-semibold">{v.name}</span>
                    <span className="flex shrink-0 items-center gap-2 text-ink-muted">
                      <span className="tabular-nums">
                        {v.selesai}/{v.total}
                      </span>
                      {v.terlambat > 0 && <Badge tone="red">{v.terlambat} terlambat</Badge>}
                    </span>
                  </div>
                  <ProgressBar
                    value={pct(v.selesai, v.total)}
                    tone={v.terlambat > 0 ? "red" : "green"}
                    label={`selesai, ${v.name}`}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
