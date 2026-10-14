import { ArchiveSection } from "@/components/ArchiveSection";
import { Hero } from "@/components/Hero";
import { InfoSection } from "@/components/InfoSection";
import { SiteFooter } from "@/components/SiteFooter";

export default function Home() {
  return (
    <>
      <main id="konten">
        <Hero />
        <InfoSection />
        <ArchiveSection />
      </main>
      <SiteFooter />
    </>
  );
}
