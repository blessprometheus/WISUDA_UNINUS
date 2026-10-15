import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TimelineShell } from "@/components/timeline/TimelineShell";
import { staffEnabled } from "@/content/site";

export const metadata: Metadata = {
  title: "Timeline Pekerjaan",
  robots: { index: false, follow: false },
};

export default function TimelinePage() {
  if (!staffEnabled) notFound();
  return <TimelineShell />;
}
