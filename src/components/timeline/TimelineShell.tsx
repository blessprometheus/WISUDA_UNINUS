"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { btnGold } from "@/components/admin/ui";
import { Timeline } from "@/components/timeline/Timeline";
import { api, hardNavigate, type Profile } from "@/lib/api";

const ROLE_LABEL = {
  superadmin: "Superadmin",
  ketua: "Ketua",
  koordinator: "Koordinator divisi",
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

  if (state === "loading") return <p className="p-8 text-lg">Memeriksa sesi…</p>;
  if (state === "forbidden" || !profile) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <h1 className="text-3xl font-extrabold">Akses ditolak</h1>
        <p className="mt-3 text-lg text-ink-muted">
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
    <div className="min-h-screen bg-mist-bg text-forest-900">
      <header className="bg-forest-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-gold">
              Wisuda ke-70
            </p>
            <p className="text-xl font-extrabold">Timeline Pekerjaan Panitia</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[14px]">
            <span className="text-mist">
              {profile.user.name} · {ROLE_LABEL[role]}
            </span>
            {role === "superadmin" && (
              <Link href="/admin" className="font-semibold text-white underline underline-offset-4">
                Dashboard
              </Link>
            )}
            <button
              type="button"
              onClick={logout}
              className="min-h-11 font-semibold underline underline-offset-4"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>
      <main id="konten" className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <Timeline role={role} />
      </main>
    </div>
  );
}
