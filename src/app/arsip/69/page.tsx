import type { Metadata } from "next";
import { ArchiveList } from "@/components/ArchiveList";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Arsip Wisuda ke-69",
  description: "Galeri foto, e-book, dan survei kepuasan Wisuda ke-69 Universitas Islam Nusantara.",
  alternates: { canonical: "/arsip/69" },
};

export default function Arsip69Page() {
  return (
    <>
      <div className="bg-forest-950">
        <SiteHeader />
      </div>
      <main id="konten" className="bg-forest-900 text-white">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-16 sm:px-8 lg:py-24">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-gold">Arsip</p>
          <h1 className="text-[clamp(40px,6vw,72px)] font-extrabold leading-none tracking-[-0.03em]">
            Wisuda ke-69
          </h1>
          <p className="max-w-[520px] text-[17px] leading-7 text-mist">
            Galeri foto, e-book, dan survei kepuasan wisuda sebelumnya tetap dapat diakses.
          </p>
          <ArchiveList />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
