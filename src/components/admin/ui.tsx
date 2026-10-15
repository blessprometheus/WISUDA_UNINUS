"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { api, type ApiResult, type PageMeta } from "@/lib/api";

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded bg-forest-900 px-4 text-[14px] font-bold text-white hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-50";
export const btnGold =
  "inline-flex min-h-11 items-center justify-center rounded bg-gold px-4 text-[14px] font-bold text-forest-900 hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost =
  "inline-flex min-h-11 items-center justify-center rounded border-2 border-forest-900/30 px-4 text-[14px] font-bold text-forest-900 hover:bg-forest-900/5 disabled:cursor-not-allowed disabled:opacity-50";
export const btnDanger =
  "inline-flex min-h-11 items-center justify-center rounded bg-[#b3261e] px-4 text-[14px] font-bold text-white hover:bg-[#8f1d17] disabled:cursor-not-allowed disabled:opacity-50";
export const inputClass =
  "min-h-11 w-full rounded border-2 border-forest-900/25 bg-white px-3 text-[15px] text-forest-900 focus:border-forest-900";

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-3xl font-extrabold tracking-tight text-forest-900">{title}</h1>
      {children}
    </div>
  );
}

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-forest-900/10 bg-white p-5 shadow-sm ${className}`}
    >
      {title && <h2 className="mb-4 text-lg font-extrabold text-forest-900">{title}</h2>}
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-bold uppercase tracking-[0.06em] text-ink-muted">
      {label}
      {children}
    </label>
  );
}

export function Notice({
  kind,
  children,
}: {
  kind: "info" | "error" | "success";
  children: ReactNode;
}) {
  const tone =
    kind === "error"
      ? "border-[#b3261e] bg-[#fdecea] text-[#7a1712]"
      : kind === "success"
        ? "border-[#0b7a3e] bg-[#e7f5ec] text-[#0a4d28]"
        : "border-forest-900/30 bg-mist-bg text-forest-900";
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`rounded border-l-4 px-4 py-3 text-[15px] font-semibold ${tone}`}
    >
      {children}
    </p>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b-2 border-forest-900/20 text-[12px] uppercase tracking-[0.08em] text-ink-muted">
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-forest-900/10">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-top ${className}`}>{children}</td>;
}

export function Badge({
  tone,
  children,
}: {
  tone: "green" | "gold" | "red" | "gray";
  children: ReactNode;
}) {
  const map = {
    green: "bg-[#e7f5ec] text-[#0a4d28]",
    gold: "bg-[#fff3c4] text-[#6b5200]",
    red: "bg-[#fdecea] text-[#7a1712]",
    gray: "bg-forest-900/10 text-forest-900",
  } as const;
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[12px] font-bold ${map[tone]}`}>
      {children}
    </span>
  );
}

export function Pager({ meta, onPage }: { meta?: PageMeta; onPage: (page: number) => void }) {
  if (!meta || meta.last_page <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-[14px]">
      <span className="text-ink-muted">
        Halaman {meta.page} dari {meta.last_page} · {meta.total} data
      </span>
      <span className="flex gap-2">
        <button
          type="button"
          className={btnGhost}
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          Sebelumnya
        </button>
        <button
          type="button"
          className={btnGhost}
          disabled={meta.page >= meta.last_page}
          onClick={() => onPage(meta.page + 1)}
        >
          Berikutnya
        </button>
      </span>
    </div>
  );
}

export function when(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function clockOf(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface LoadState<T> {
  key: string;
  result: ApiResult<T>;
}

/**
 * Memuat data GET. `path = null` menunda pemuatan. `reload()` memuat ulang.
 * `loading` bernilai true selama hasil belum cocok dengan permintaan terakhir.
 */
export function useLoad<T>(path: string | null) {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<LoadState<T> | null>(null);
  const key = `${path}#${tick}`;

  useEffect(() => {
    if (!path) return;
    let alive = true;
    void api<T>("GET", path).then((result) => {
      if (alive) setState({ key: `${path}#${tick}`, result });
    });
    return () => {
      alive = false;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const ready = state?.key === key;
  return {
    loading: Boolean(path) && !ready,
    data: state?.result.data,
    meta: state?.result.meta,
    error: ready && !state.result.ok ? (state.result.message ?? "Gagal memuat data.") : null,
    reload,
  };
}
