import { ArchiveSection } from "@/components/ArchiveSection";
import { Hero } from "@/components/Hero";
import { InfoSection } from "@/components/InfoSection";
import { QrSection } from "@/components/QrSection";
import { SiteFooter } from "@/components/SiteFooter";
import { qrEnabled } from "@/content/site";

export default function Home() {
  return (
    <>
      <main id="konten">
        <Hero />
        <InfoSection />
        {qrEnabled && <QrSection />}
        <ArchiveSection />
      </main>
      <SiteFooter />
    </>
  );
}
