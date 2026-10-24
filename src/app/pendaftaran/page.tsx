import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RegistrationForm } from "@/components/RegistrationForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { qrEnabled, siteConfig } from "@/content/site";

export const metadata: Metadata = {
  title: `Formulir Pendaftaran ${siteConfig.shortName}`,
  description:
    "Formulir verifikasi kelayakan (pembayaran & yudisium) dan pendaftaran online Wisuda ke-70 Universitas Islam Nusantara (UNINUS).",
};

export default function PendaftaranPage() {
  if (!qrEnabled) notFound();
  return (
    <div className="flex min-h-screen flex-col bg-mist-bg text-forest-900">
      <div className="bg-forest-900 text-white print:hidden">
        <SiteHeader />
      </div>
      <main
        id="konten"
        className="mx-auto flex w-full max-w-7xl grow flex-col px-4 py-8 sm:px-8 sm:py-12"
      >
        <RegistrationForm />
      </main>
      <div className="print:hidden">
        <SiteFooter />
      </div>
    </div>
  );
}
