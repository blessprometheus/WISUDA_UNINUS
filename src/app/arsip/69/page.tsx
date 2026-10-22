import type { Metadata } from "next";
import { ArchiveList } from "@/components/ArchiveList";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import styles from "@/components/ArchiveGallery.module.css";

export const metadata: Metadata = {
  title: "Arsip Wisuda ke-69",
  description: "Galeri foto, e-book, dan survei kepuasan Wisuda ke-69 Universitas Islam Nusantara.",
  alternates: { canonical: "/arsip/69" },
};

export default function Arsip69Page() {
  return (
    <>
      <SmoothScroll />
      <div className="bg-forest-950">
        <SiteHeader />
      </div>
      <main id="konten" className={styles.page}>
        <div className={styles.container}>
          <div className={styles.pageIntro}>
            <h1 className={styles.heading}>Arsip Wisuda ke-69</h1>
          </div>
          <ArchiveList />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
