import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LoginFlow } from "@/components/staff/LoginFlow";
import { staffEnabled } from "@/content/site";

export const metadata: Metadata = {
  title: "Masuk Petugas",
  robots: { index: false, follow: false },
};

export default function MasukPage() {
  if (!staffEnabled) notFound();
  return (
    <main
      id="konten"
      className="flex min-h-screen items-center justify-center bg-forest-950 px-4 py-12 text-white"
    >
      <Suspense>
        <LoginFlow />
      </Suspense>
    </main>
  );
}
