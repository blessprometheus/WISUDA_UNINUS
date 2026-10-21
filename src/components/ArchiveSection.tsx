import { ArchiveList } from "@/components/ArchiveList";
import styles from "@/components/ArchiveGallery.module.css";

export function ArchiveSection() {
  return (
    <section id="arsip" aria-labelledby="judul-arsip" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>Arsip wisuda</p>
            <h2 id="judul-arsip" className={styles.heading}>
              Wisuda ke-69
            </h2>
          </div>
          <p className={styles.description}>
            Dokumentasi dan tautan resmi dari penyelenggaraan sebelumnya. Pilih arsip yang sudah
            tersedia di bawah ini.
          </p>
        </div>
        <ArchiveList />
      </div>
    </section>
  );
}
