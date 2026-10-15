import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Scanner } from "@/components/staff/Scanner";
import { staffEnabled } from "@/content/site";

export const metadata: Metadata = {
  title: "Pemindai Kehadiran",
  robots: { index: false, follow: false },
};

export default function PemindaiPage() {
  if (!staffEnabled) notFound();
  return (
    <main id="konten" className="min-h-screen bg-forest-950 text-white">
      <Scanner />
    </main>
  );
}
