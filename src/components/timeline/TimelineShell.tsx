"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { IconDashboard, IconExternalLink, IconLogout } from "@/components/admin/icons";
import { btnGold } from "@/components/admin/ui";
import { Timeline } from "@/components/timeline/Timeline";
import { api, hardNavigate, type Profile } from "@/lib/api";

const ROLE_LABEL = {
  superadmin: "Superadmin",
  ketua: "Ketua Panitia",
  koordinator: "Koordinator Divisi",
  petugas: "Petugas",
} as const;

/** Penjaga akses sisi klien; API tetap memeriksa peran dan divisi di server pada setiap permintaan. */
export function TimelineShell() {
  const [state, setState] = useState<"loading" | "forbidden" | "ready">("loading");
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    void (async () => {
      const me = await api<Profile>("GET", "/api/v1/auth/me");
      if (!me.ok || !me.data) {
        hardNavigate(`/masuk?next=${encodeURIComponent("/timeline")}`);
        return;
      }
      setProfile(me.data);
      const role = me.data.user.role;
      setState(role === "petugas" ? "forbidden" : "ready");
    })();
  }, []);

  const logout = async () => {
    await api("POST", "/api/v1/auth/logout");
    hardNavigate("/masuk");
  };

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7f5] p-8 text-sm font-bold text-slate-600">
        Memeriksa sesi kepanitiaan…
      </div>
    );
  }
  if (state === "forbidden" || !profile) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <h1 className="text-3xl font-extrabold text-slate-900">Akses ditolak</h1>
        <p className="mt-3 text-base text-slate-600">
          Akun Anda tidak memiliki akses ke timeline pekerjaan.
        </p>
        <button type="button" onClick={logout} className={`${btnGold} mt-6`}>
          Keluar
        </button>
      </div>
    );
  }

  const role = profile.user.role;
  return (
    <div className="min-h-screen bg-[#f4f7f5] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-emerald-900/70 bg-[#002b15] text-white shadow-sm">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#f4c430]/50 bg-emerald-800/70 p-1.5">
              <Image
                src="/branding/logo-uninus.png"
                alt="Logo UNINUS"
                width={32}
                height={32}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#f4c430]">
                  SIM WISUDA UNINUS • WISUDA KE-70
                </span>
              </div>
              <h1 className="text-lg font-extrabold leading-tight sm:text-xl">
                Kalender Timeline & Progres Kepanitiaan Lintas Divisi
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="rounded-xl border border-emerald-700/70 bg-[#003b1d] px-3.5 py-2">
              <span className="font-bold text-white">{profile.user.name}</span>
              <span className="ml-2 rounded bg-[#f4c430]/20 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-[#f4c430]">
                {ROLE_LABEL[role]}
              </span>
            </div>
            {role === "superadmin" && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#f4c430] px-3.5 py-2 font-extrabold text-[#002b15] no-underline transition hover:bg-amber-400"
              >
                <IconDashboard className="h-4 w-4" />
                Dashboard Utama
              </Link>
            )}
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 font-bold text-white no-underline transition hover:bg-white/20"
            >
              Portal Publik
              <IconExternalLink className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={logout}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-red-500/20 px-3.5 py-2 font-bold text-red-200 transition hover:bg-red-500 hover:text-white"
            >
              <IconLogout className="h-4 w-4" />
              Keluar
            </button>
          </div>
        </div>
      </header>
      <main id="konten" className="mx-auto max-w-[1600px] px-4 py-6 sm:px-8 sm:py-8">
        <Timeline role={role} />
      </main>
    </div>
  );
}
