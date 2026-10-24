"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";

import {
  IconCalendar,
  IconClipboardCheck,
  IconDashboard,
  IconDatabase,
  IconExternalLink,
  IconGraduation,
  IconListChecks,
  IconLogout,
  IconMenu,
  IconQrCode,
  IconScan,
  IconShield,
  IconSparkles,
  IconUpload,
  IconUsers,
  IconX,
} from "@/components/admin/icons";
import { btnGold } from "@/components/admin/ui";
import { api, hardNavigate, type Profile } from "@/lib/api";

interface NavItem {
  href: string;
  label: string;
  desc: string;
  Icon: ComponentType<{ className?: string }>;
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard Statistik",
    desc: "Ringkasan Prodi, Toga, JK, Angkatan",
    Icon: IconDashboard,
  },
  {
    href: "/admin/wisudawan",
    label: "Database Wisudawan",
    desc: "Data Awalan, Kelayakan & Verifikasi",
    Icon: IconDatabase,
  },
  {
    href: "/admin/impor",
    label: "Impor & Sinkronisasi",
    desc: "Spreadsheet Keuangan & CSV BAAK",
    Icon: IconUpload,
  },
  {
    href: "/admin/kehadiran",
    label: "Presensi & Kehadiran",
    desc: "Rekap Scan QR & Entri Manual",
    Icon: IconClipboardCheck,
  },
  {
    href: "/admin/sesi",
    label: "Sesi Kehadiran",
    desc: "Jadwal Jam Scan Gladi & Hari-H",
    Icon: IconCalendar,
  },
  {
    href: "/admin/divisi",
    label: "Divisi & Timeline",
    desc: "Koordinator & Agenda Kepanitiaan",
    Icon: IconListChecks,
  },
  {
    href: "/admin/pengguna",
    label: "Manajemen Pengguna",
    desc: "Akun Petugas, Koordinator & Ketua",
    Icon: IconUsers,
  },
  {
    href: "/admin/audit",
    label: "Audit Log & Retensi",
    desc: "Jejak Aktivitas & Anonimisasi Data",
    Icon: IconShield,
  },
];

const HEADER_META: Record<string, { title: string; subtitle: string }> = {
  "/admin": {
    title: "Dashboard Eksekutif — Wisuda Ke-70 UNINUS",
    subtitle:
      "Rekapitulasi Statistik Berdasarkan Fakultas, Program Studi, Angkatan, Jenis Kelamin, Ukuran Baju Toga & Kehadiran",
  },
  "/admin/wisudawan": {
    title: "Database Wisudawan & Data Awalan — Wisuda Ke-70 UNINUS",
    subtitle:
      "Kelola Kandidat Yudisium (Data Awalan), Status Lunas Keuangan, Kelulusan Yudisium & Verifikasi Pendaftaran",
  },
  "/admin/impor": {
    title: "Impor Data Awalan & Sinkronisasi Spreadsheet Keuangan",
    subtitle:
      "Integrasi CSV Data Dasar BAAK serta Sinkronisasi Cepat Status Pembayaran & Yudisium Wisudawan",
  },
  "/admin/kehadiran": {
    title: "Presensi Kehadiran & Rekap Pemindaian QR — Wisuda Ke-70 UNINUS",
    subtitle:
      "Pantau Kehadiran Real-Time, Unduh Rekap CSV Seluruh Wisudawan & Tinjau Entri Tidak Terdaftar",
  },
  "/admin/sesi": {
    title: "Manajemen Sesi Gladi Resik & Prosesi Hari-H",
    subtitle: "Pengaturan Sesi Aktif dan Rentang Waktu Buka/Tutup Pemindaian QR Kehadiran",
  },
  "/admin/divisi": {
    title: "Manajemen Divisi Kepanitiaan & Koordinator",
    subtitle: "Kelola Struktur Divisi Panitia Wisuda dan Penugasan Koordinator Lintas Divisi",
  },
  "/admin/pengguna": {
    title: "Manajemen Akun & Hak Akses Kepanitiaan",
    subtitle: "Buat Akun Petugas Scanner, Koordinator Divisi, dan Ketua Panitia secara Terpusat",
  },
  "/admin/audit": {
    title: "Jejak Audit Sistem (Audit Logs) & Retensi Data Pribadi",
    subtitle:
      "Rekaman Aktivitas Verifikasi Wisudawan, Impor Spreadsheet, Pembaruan Sesi & Anonimisasi Pascawisuda",
  },
};

/** Penjaga akses sisi klien (API tetap memeriksa peran di server pada setiap permintaan). */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<"loading" | "forbidden" | "ready">("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7f5] p-8 text-sm font-bold text-slate-600">
        Memeriksa sesi kepanitiaan…
      </div>
    );
  }
  if (state === "forbidden") {
    return (
      <div className="mx-auto max-w-xl p-8">
        <h1 className="text-3xl font-extrabold text-slate-900">Akses ditolak</h1>
        <p className="mt-3 text-base text-slate-600">Dashboard ini hanya untuk superadmin.</p>
        <button type="button" onClick={logout} className={`${btnGold} mt-6`}>
          Keluar
        </button>
      </div>
    );
  }

  const headerInfo = HEADER_META[pathname] ?? HEADER_META["/admin"]!;

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#002b15] text-white border-r border-emerald-900/70">
      {/* Brand Header */}
      <div className="flex h-20 items-center justify-between border-b border-emerald-800/60 bg-[#002211] px-5">
        <Link href="/admin" className="flex items-center gap-3.5 no-underline">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#f4c430]/50 bg-emerald-800/70 p-1.5 shadow-inner">
            <Image
              src="/branding/logo-uninus.png"
              alt="Logo UNINUS"
              width={32}
              height={32}
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold tracking-tight text-white text-base">SIM WISUDA</span>
              <span className="rounded bg-[#f4c430] px-1.5 py-0.5 text-[10px] font-black text-[#002b15]">
                UNINUS
              </span>
            </div>
            <p className="text-[11px] font-medium text-emerald-300/80">
              Portal Manajemen & Kepanitiaan
            </p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1.5 text-emerald-200 hover:text-white lg:hidden"
          aria-label="Tutup menu"
        >
          <IconX className="h-5 w-5" />
        </button>
      </div>

      {/* Edisi Wisuda Aktif Badge */}
      <div className="border-b border-emerald-800/50 bg-emerald-950/60 px-4 py-3.5">
        <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#f4c430]">
          <IconSparkles className="h-3.5 w-3.5" /> Periode Wisuda Aktif
        </span>
        <div className="flex items-center justify-between rounded-xl border border-emerald-700/70 bg-[#003b1d] px-3 py-2 text-xs font-bold text-white">
          <span>Wisuda Ke-70 UNINUS</span>
          <span className="rounded-md bg-[#f4c430]/20 px-1.5 py-0.5 text-[10px] font-extrabold text-[#f4c430]">
            2026
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav aria-label="Menu dashboard" className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
        <div className="px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-400/70">
          Menu Utama Dashboard
        </div>
        {NAV_ITEMS.map(({ href, label, desc, Icon }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`group flex items-start gap-3 rounded-xl px-3.5 py-3 no-underline transition-all ${
                active
                  ? "bg-gradient-to-r from-[#006837] to-[#00522b] text-white shadow-sm ring-1 ring-[#f4c430]/50"
                  : "text-emerald-100/80 hover:bg-emerald-900/50 hover:text-white"
              }`}
            >
              <Icon
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  active ? "text-[#f4c430]" : "text-emerald-400 group-hover:text-[#f4c430]"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold leading-tight">{label}</div>
                <div className="mt-0.5 truncate text-[11px] text-emerald-200/70">{desc}</div>
              </div>
            </Link>
          );
        })}

        {/* Pintasan Laman Publik & Operasional */}
        <div className="px-3 pb-1.5 pt-4 text-[10px] font-extrabold uppercase tracking-wider text-emerald-400/70">
          Pintasan Operasional & Publik
        </div>
        <Link
          href="/pendaftaran"
          className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold text-emerald-200/90 no-underline transition hover:bg-emerald-900/40 hover:text-white"
        >
          <span className="flex items-center gap-2.5">
            <IconGraduation className="h-4 w-4 text-[#f4c430]" />
            Form Pendaftaran Wisudawan
          </span>
          <IconExternalLink className="h-3.5 w-3.5 opacity-60" />
        </Link>
        <Link
          href="/pemindai"
          className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold text-emerald-200/90 no-underline transition hover:bg-emerald-900/40 hover:text-white"
        >
          <span className="flex items-center gap-2.5">
            <IconScan className="h-4 w-4 text-emerald-400" />
            Buka Loket Pemindai QR
          </span>
          <IconExternalLink className="h-3.5 w-3.5 opacity-60" />
        </Link>
        <Link
          href="/timeline"
          className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold text-emerald-200/90 no-underline transition hover:bg-emerald-900/40 hover:text-white"
        >
          <span className="flex items-center gap-2.5">
            <IconCalendar className="h-4 w-4 text-amber-300" />
            Kalender Timeline Panitia
          </span>
          <IconExternalLink className="h-3.5 w-3.5 opacity-60" />
        </Link>
        <Link
          href="/#unduh-qr"
          className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold text-emerald-200/90 no-underline transition hover:bg-emerald-900/40 hover:text-white"
        >
          <span className="flex items-center gap-2.5">
            <IconQrCode className="h-4 w-4 text-blue-300" />
            Unduh Kartu QR Kehadiran
          </span>
          <IconExternalLink className="h-3.5 w-3.5 opacity-60" />
        </Link>
      </nav>

      {/* User Profile & Logout */}
      <div className="border-t border-emerald-800/60 bg-[#001f0f] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-white">
              {profile?.user.name || "Superadmin UNINUS"}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-emerald-300/80">
              <span className="truncate">Administrator Utama</span>
              <span className="rounded bg-[#f4c430]/20 px-1.5 py-0.2 text-[9px] font-extrabold uppercase text-[#f4c430]">
                {profile?.user.role || "superadmin"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="cursor-pointer rounded-xl bg-red-500/15 p-2 text-red-300 transition hover:bg-red-500 hover:text-white"
            title="Keluar"
            aria-label="Keluar"
          >
            <IconLogout className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#f4f7f5] text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:shrink-0 lg:flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 flex w-72 max-w-full flex-col">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Sticky Header */}
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Buka menu navigasi"
            >
              <IconMenu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-base font-extrabold text-slate-900 sm:text-xl">
                {headerInfo.title}
              </h2>
              <p className="mt-0.5 hidden truncate text-xs text-slate-500 sm:block">
                {headerInfo.subtitle}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <Link
              href="/pendaftaran"
              className="hidden items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-extrabold text-[#006837] no-underline transition hover:bg-emerald-100 md:inline-flex"
            >
              <IconGraduation className="h-3.5 w-3.5" />
              <span>Form Pendaftaran</span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 no-underline transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-[#006837]"
            >
              <span>Lihat Portal Publik</span>
              <IconExternalLink className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={logout}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-600 hover:text-white lg:hidden"
            >
              Keluar
            </button>
          </div>
        </header>

        {/* Page Body */}
        <main id="konten" className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
