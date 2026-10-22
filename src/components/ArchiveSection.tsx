import { ArchiveList } from "@/components/ArchiveList";
import styles from "@/components/ArchiveGallery.module.css";

export function ArchiveSection() {
  return (
    <section id="arsip" aria-labelledby="judul-arsip" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.intro}>
          <h2 id="judul-arsip" className={styles.heading}>
            Arsip Wisuda ke-69
          </h2>
        </div>
        <ArchiveList />
      </div>
    </section>
  );
}
