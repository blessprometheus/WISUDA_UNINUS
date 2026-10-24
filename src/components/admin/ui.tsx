"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { api, type ApiResult, type PageMeta } from "@/lib/api";

const btnBase =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-extrabold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50";
export const btnPrimary = `${btnBase} bg-[#006837] text-white shadow-xs hover:bg-[#004220]`;
export const btnGold = `${btnBase} bg-[#f4c430] text-[#002b15] shadow-xs hover:bg-amber-400`;
export const btnGhost = `${btnBase} border border-slate-300 bg-white text-slate-700 hover:border-emerald-500/40 hover:bg-emerald-50/50 hover:text-[#006837]`;
export const btnDanger = `${btnBase} bg-red-600 text-white shadow-xs hover:bg-red-700`;
export const inputClass =
  "min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-900 transition-colors duration-150 focus:border-[#006837] focus:outline-hidden focus:ring-2 focus:ring-[#006837]/20";

export function PageTitle({
  title,
  subtitle,
  eyebrow,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/80 pb-4">
      <div>
        {eyebrow && (
          <span className="block text-[11px] font-extrabold uppercase tracking-wider text-[#006837]">
            {eyebrow}
          </span>
        )}
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  eyebrow,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    // min-w-0: kartu di dalam grid tidak boleh melebar mengikuti tabel di dalamnya (penyebab geser horizontal di HP).
    <section
      className={`min-w-0 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xs ${className}`}
    >
      {(title || eyebrow) && (
        <div className="mb-4 border-b border-slate-100 pb-3">
          {eyebrow && (
            <span className="block text-[11px] font-extrabold uppercase tracking-wider text-[#006837]">
              {eyebrow}
            </span>
          )}
          {title && <h2 className="text-base font-extrabold text-slate-900 sm:text-lg">{title}</h2>}
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-extrabold text-slate-700">
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
      ? "border-red-300 bg-red-50 text-red-900"
      : kind === "success"
        ? "border-emerald-300 bg-emerald-50 text-emerald-950"
        : "border-slate-200 bg-white text-slate-800 shadow-2xs";
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-2xl border px-4 py-3.5 text-xs sm:text-sm font-semibold ${tone}`}
    >
      {children}
    </p>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            {head.map((h) => (
              <th key={h} scope="col" className="px-3.5 py-3 font-extrabold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-3.5 py-3 align-top ${className}`}>{children}</td>;
}

export function Badge({
  tone,
  children,
}: {
  tone: "green" | "gold" | "red" | "gray" | "blue";
  children: ReactNode;
}) {
  const map = {
    green: "border-emerald-200 bg-emerald-100 text-emerald-900",
    gold: "border-amber-300 bg-amber-100 text-amber-900",
    red: "border-red-200 bg-red-100 text-red-900",
    gray: "border-slate-200 bg-slate-100 text-slate-700",
    blue: "border-blue-200 bg-blue-100 text-blue-900",
  } as const;
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${map[tone]}`}
    >
      {children}
    </span>
  );
}

export function Pager({ meta, onPage }: { meta?: PageMeta; onPage: (page: number) => void }) {
  if (!meta || meta.last_page <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs font-semibold">
      <span className="text-slate-500">
        Halaman <strong className="text-slate-900">{meta.page}</strong> dari{" "}
        <strong className="text-slate-900">{meta.last_page}</strong> ·{" "}
        <strong className="text-[#006837]">{meta.total}</strong> data
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
  /** Hasil terakhir yang BERHASIL untuk `path` yang sama (dipertahankan bila pemuatan ulang gagal). */
  good: { path: string; result: ApiResult<T>; at: number } | null;
}

/**
 * Memuat data GET. `path = null` menunda pemuatan. `reload()` memuat ulang.
 * `loading` bernilai true selama hasil belum cocok dengan permintaan terakhir.
 * Bila pemuatan ulang gagal, data terakhir yang berhasil untuk path yang sama tetap dikembalikan bersama `error`,
 * dan `updatedAt` menunjukkan kapan data itu diperoleh (agar tampilan dapat menandainya usang).
 */
export function useLoad<T>(path: string | null) {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<LoadState<T> | null>(null);
  const key = `${path}#${tick}`;

  useEffect(() => {
    if (!path) return;
    let alive = true;
    void api<T>("GET", path).then((result) => {
      if (!alive) return;
      setState((prev) => ({
        key: `${path}#${tick}`,
        result,
        good: result.ok
          ? { path, result, at: Date.now() }
          : prev?.good?.path === path
            ? prev.good
            : null,
      }));
    });
    return () => {
      alive = false;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const ready = state?.key === key;
  const good = state?.good && state.good.path === path ? state.good : null;
  return {
    loading: Boolean(path) && !ready,
    data: state?.result.data ?? good?.result.data,
    meta: state?.result.meta ?? good?.result.meta,
    error: ready && !state.result.ok ? (state.result.message ?? "Gagal memuat data.") : null,
    updatedAt: good?.at ?? null,
    reload,
  };
}
