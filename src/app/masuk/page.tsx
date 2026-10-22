import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LoginFlow } from "@/components/staff/LoginFlow";
import { siteConfig, staffEnabled } from "@/content/site";

export const metadata: Metadata = {
  title: "Masuk Petugas",
  robots: { index: false, follow: false },
};

/** Garis kubah statis bergaya logo (dekoratif). */
function Dome() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 900"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full opacity-35"
    >
      <path
        d="M60 900 V420 C60 280 260 170 400 40 C540 170 740 280 740 420 V900"
        fill="none"
        stroke="#ffcc29"
        strokeWidth="2"
      />
      <path
        d="M130 900 V440 C130 320 290 230 400 120 C510 230 670 320 670 440 V900"
        fill="none"
        stroke="#ffcc29"
        strokeWidth="1"
        opacity="0.6"
      />
      <path
        d="M200 900 V460 C200 360 320 290 400 200 C480 290 600 360 600 460 V900"
        fill="none"
        stroke="#ffcc29"
        strokeWidth="1"
        opacity="0.35"
      />
    </svg>
  );
}

export default function MasukPage() {
  if (!staffEnabled) notFound();
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside
        aria-label="Wisuda ke-70 Universitas Islam Nusantara"
        className="relative flex flex-col justify-between overflow-hidden bg-[radial-gradient(ellipse_at_30%_20%,#14452f_0%,#0e3324_55%,#082418_100%)] px-6 py-6 text-white sm:px-10 lg:px-14 lg:py-12"
      >
        <Dome />
        <div className="relative z-10 flex items-center gap-3">
          <Image
            src="/brand/logo-uninus.png"
            alt=""
            width={44}
            height={60}
            className="h-auto w-9 lg:w-11"
            priority
          />
          <span className="text-[14px] font-bold uppercase tracking-[0.18em]">
            Universitas Islam Nusantara
          </span>
        </div>

        <div className="relative z-10 hidden py-16 lg:block">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-gold">
            Portal petugas &amp; panitia
          </p>
          <p
            className="mt-5 flex flex-col font-extrabold leading-[0.88] tracking-[-0.04em]"
            aria-hidden="true"
          >
            <span className="text-[clamp(40px,4.5vw,64px)]">Wisuda</span>
            <span className="text-[clamp(110px,14vw,210px)]">
              ke-<span className="text-gold">70</span>
            </span>
          </p>
          <p className="mt-8 max-w-sm text-[17px] leading-7 text-mist">
            Pemindai kehadiran, rekap, dan pengelolaan data wisudawan, dalam satu tempat yang aman.
          </p>
        </div>

        <div className="relative z-10 hidden items-center gap-4 text-[14px] text-mist-dim lg:flex">
          <span aria-hidden="true" className="h-0.5 w-10 bg-gold" />
          {siteConfig.eventDate}
        </div>

        <p className="relative z-10 mt-4 text-[13px] font-semibold uppercase tracking-[0.2em] text-gold lg:hidden">
          Wisuda ke-70 · Portal petugas
        </p>
      </aside>

      <main
        id="konten"
        className="flex flex-col items-center justify-center bg-mist-bg px-6 py-12 text-forest-900 sm:px-10"
      >
        <Suspense>
          <LoginFlow />
        </Suspense>
        <Link
          href="/"
          className="mt-10 text-[14px] font-semibold text-ink-muted underline underline-offset-4 hover:text-forest-900"
        >
          ← Kembali ke situs Wisuda
        </Link>
      </main>
    </div>
  );
}
