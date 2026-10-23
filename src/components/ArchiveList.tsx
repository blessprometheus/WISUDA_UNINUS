import { archive69Links } from "@/content/site";
import styles from "@/components/ArchiveGallery.module.css";

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className={styles.arrow}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 19 19 5M8 5h11v11" />
    </svg>
  );
}

export function ArchiveList() {
  return (
    <ul className={styles.list} aria-label="Arsip Wisuda ke-69">
      {archive69Links.map((link, index) => {
        const featured = index === 0;
        const cardClass = [
          styles.card,
          featured ? styles.featured : styles.secondary,
          link.href ? styles.available : "",
        ].join(" ");
        const content = (
          <>
            <span className={styles.cardTop}>
              <span className={styles.cardStatus}>{link.href ? "Tersedia" : "Belum tersedia"}</span>
            </span>
            <span className={styles.cardBottom}>
              <strong className={styles.cardTitle}>{link.label}</strong>
              {link.href ? (
                <span className={styles.arrowBox}>
                  <ArrowIcon />
                </span>
              ) : null}
            </span>
          </>
        );

        return (
          <li className={featured ? styles.featuredItem : styles.secondaryItem} key={link.label}>
            {link.href ? (
              <a className={cardClass} href={link.href} target="_blank" rel="noopener noreferrer">
                {content}
              </a>
            ) : (
              <div className={cardClass}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
