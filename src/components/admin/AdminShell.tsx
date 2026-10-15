"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { btnGold } from "@/components/admin/ui";
import { api, hardNavigate, type Profile } from "@/lib/api";

const NAV = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/sesi", label: "Sesi" },
  { href: "/admin/wisudawan", label: "Wisudawan" },
  { href: "/admin/impor", label: "Impor Data" },
  { href: "/admin/kehadiran", label: "Kehadiran" },
  { href: "/admin/pengguna", label: "Pengguna" },
  { href: "/admin/audit", label: "Audit & Retensi" },
] as const;

/** Penjaga akses sisi klien (API tetap memeriksa peran di server pada setiap permintaan). */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<"loading" | "forbidden" | "ready">("loading");
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    void (async () => {
      const me = await api<Profile>("GET", "/api/v1/auth/me");
      if (!me.ok || !me.data || !me.data.mfa.verified) {
        hardNavigate(`/masuk?next=${encodeURIComponent("/admin")}`);
        return;
      }
      setProfile(me.data);
      setState(me.data.user.role === "superadmin" ? "ready" : "forbidden");
    })();
  }, []);

  const logout = async () => {
    await api("POST", "/api/v1/auth/logout");
    hardNavigate("/masuk");
  };

  if (state === "loading") return <p className="p-8 text-lg">Memeriksa sesi…</p>;
  if (state === "forbidden") {
    return (
      <div className="mx-auto max-w-xl p-8">
        <h1 className="text-3xl font-extrabold">Akses ditolak</h1>
        <p className="mt-3 text-lg text-ink-muted">Dashboard ini hanya untuk superadmin.</p>
        <button type="button" onClick={logout} className={`${btnGold} mt-6`}>
          Keluar
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-mist-bg text-forest-900 lg:flex-row">
      <aside className="bg-forest-950 text-white lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0">
        <div className="flex items-center justify-between gap-3 px-4 py-4 lg:flex-col lg:items-start">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-gold">
              Wisuda ke-70
            </p>
            <p className="text-lg font-extrabold">Dashboard</p>
          </div>
          <p className="hidden text-[13px] text-mist-dim lg:block">{profile?.user.name}</p>
        </div>
        <nav
          aria-label="Menu dashboard"
          className="flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {NAV.map((item) => {
            const active =
              item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 shrink-0 items-center rounded px-3 text-[15px] font-semibold no-underline ${
                  active ? "bg-gold text-forest-900" : "text-white hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden flex-col gap-1 px-2 pt-6 lg:flex">
          <Link
            href="/pemindai"
            className="flex min-h-11 items-center rounded px-3 text-[14px] font-semibold text-mist no-underline hover:bg-white/10"
          >
            Buka pemindai ↗
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex min-h-11 items-center rounded px-3 text-left text-[14px] font-semibold text-mist hover:bg-white/10"
          >
            Keluar
          </button>
        </div>
      </aside>
      <main id="konten" className="min-w-0 flex-1 p-4 sm:p-8">
        {children}
        <div className="mt-10 flex gap-4 text-[14px] lg:hidden">
          <button type="button" onClick={logout} className="min-h-11 font-semibold underline">
            Keluar
          </button>
        </div>
      </main>
    </div>
  );
}
