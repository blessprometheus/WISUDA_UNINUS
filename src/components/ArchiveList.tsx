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
            {featured ? (
              <span className={styles.featuredNumber} aria-hidden="true">
                69
              </span>
            ) : null}
            <span className={styles.cardTop}>
              <span className={styles.cardIndex}>
                {String(index + 1).padStart(2, "0")} /{" "}
                {String(archive69Links.length).padStart(2, "0")}
              </span>
              <span className={styles.cardStatus}>
                {link.href ? "Tersedia" : "Menunggu publikasi"}
              </span>
            </span>
            <span className={styles.cardBottom}>
              <span className={styles.cardCopy}>
                <strong className={styles.cardTitle}>{link.label}</strong>
                <span className={styles.cardDescription}>{link.description}</span>
                {!link.href && featured ? (
                  <span className={styles.featuredNote}>
                    Foto resmi akan ditampilkan setelah tautan galeri diumumkan.
                  </span>
                ) : null}
              </span>
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
              <a className={cardClass} href={link.href} rel="noopener noreferrer">
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
