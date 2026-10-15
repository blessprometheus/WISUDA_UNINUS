import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/AdminShell";
import { staffEnabled } from "@/content/site";

export const metadata: Metadata = {
  title: { default: "Dashboard Superadmin", template: "%s | Dashboard Wisuda" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  if (!staffEnabled) notFound();
  return <AdminShell>{children}</AdminShell>;
}
