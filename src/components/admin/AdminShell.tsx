"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";

import {
  IconCalendar,
  IconClipboardCheck,
  IconDashboard,
  IconGraduation,
  IconListChecks,
  IconLogout,
  IconScan,
  IconShield,
  IconUpload,
  IconUsers,
} from "@/components/admin/icons";
import { btnGold } from "@/components/admin/ui";
import { api, hardNavigate, type Profile } from "@/lib/api";

interface NavItem {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}

const NAV_GROUPS: ReadonlyArray<{ title: string; items: readonly NavItem[] }> = [
  {
    title: "Kehadiran",
    items: [
      { href: "/admin", label: "Ringkasan", Icon: IconDashboard },
      { href: "/admin/sesi", label: "Sesi", Icon: IconCalendar },
      { href: "/admin/kehadiran", label: "Kehadiran", Icon: IconClipboardCheck },
      { href: "/admin/wisudawan", label: "Wisudawan", Icon: IconGraduation },
      { href: "/admin/impor", label: "Impor Data", Icon: IconUpload },
    ],
  },
  {
    title: "Panitia",
    items: [
      { href: "/admin/pengguna", label: "Pengguna", Icon: IconUsers },
      { href: "/admin/divisi", label: "Divisi & Timeline", Icon: IconListChecks },
    ],
  },
  {
    title: "Sistem",
    items: [{ href: "/admin/audit", label: "Audit & Retensi", Icon: IconShield }],
  },
];

const ROLE_LABEL = "Superadmin";

function initials(name: string | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return (
    ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() ||
    "SA"
  );
}

/** Penjaga akses sisi klien (API tetap memeriksa peran di server pada setiap permintaan). */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<"loading" | "forbidden" | "ready">("loading");
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    void (async () => {
      const me = await api<Profile>("GET", "/api/v1/auth/me");
      if (!me.ok || !me.data) {
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

  const linkBase =
    "relative flex min-h-11 shrink-0 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-[15px] font-semibold no-underline transition-colors duration-150";

  return (
    <div className="flex min-h-screen flex-col bg-mist-bg text-forest-900 lg:flex-row">
      <aside className="min-w-0 bg-forest-950 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-3 px-4 py-4 lg:py-5">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-gold">
              Wisuda ke-70
            </p>
            <p className="text-lg font-extrabold leading-tight">Dashboard</p>
          </div>
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-[13px] font-extrabold text-forest-900 lg:hidden"
          >
            {initials(profile?.user.name)}
          </span>
        </div>

        <div className="mx-3 mb-3 hidden items-center gap-3 rounded-xl bg-white/5 p-3 lg:flex">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-[14px] font-extrabold text-forest-900"
          >
            {initials(profile?.user.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold">{profile?.user.name}</p>
            <p className="text-[12px] text-mist-dim">{ROLE_LABEL}</p>
          </div>
        </div>

        <nav
          aria-label="Menu dashboard"
          className="flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-1 lg:flex-col lg:gap-5 lg:overflow-visible lg:pb-4"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="contents lg:flex lg:flex-col lg:gap-1">
              <p className="hidden px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-mist-dim lg:block">
                {group.title}
              </p>
              {group.items.map(({ href, label, Icon }) => {
                const active =
                  href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`${linkBase} ${
                      active
                        ? "bg-gold text-forest-900 lg:bg-white/10 lg:text-white"
                        : "text-white hover:bg-white/10"
                    }`}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-2 left-0 top-2 hidden w-1 rounded-r bg-gold lg:block"
                      />
                    )}
                    <Icon
                      className={`h-5 w-5 shrink-0 ${active ? "lg:text-gold" : "text-mist-dim"}`}
                    />
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="hidden flex-col gap-1 border-t border-white/10 px-2 py-3 lg:flex">
          <Link href="/pemindai" className={`${linkBase} text-[14px] text-mist hover:bg-white/10`}>
            <IconScan className="h-5 w-5 shrink-0 text-mist-dim" />
            Buka pemindai
          </Link>
          <button
            type="button"
            onClick={logout}
            className={`${linkBase} text-left text-[14px] text-mist hover:bg-white/10`}
          >
            <IconLogout className="h-5 w-5 shrink-0 text-mist-dim" />
            Keluar
          </button>
        </div>
      </aside>

      <main id="konten" className="min-w-0 flex-1 p-4 sm:p-8">
        {children}
        <div className="mt-10 flex gap-4 text-[14px] lg:hidden">
          <button
            type="button"
            onClick={logout}
            className="min-h-11 cursor-pointer font-semibold underline"
          >
            Keluar
          </button>
        </div>
      </main>
    </div>
  );
}
