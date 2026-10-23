import styles from "@/components/InfoSection.module.css";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { siteConfig } from "@/content/site";

interface Item {
  label: string;
  value: string | null;
  notes?: readonly string[];
}

/** Urutan di sini = urutan muncul saat digulir (desktop). */
const items: readonly Item[] = [
  { label: "Gladi resik", value: siteConfig.rehearsalDate },
  { label: "Hari wisuda", value: siteConfig.eventDate },
  {
    label: "Sesi",
    value: "Pagi dan siang",
    notes: ["Jam dan pembagian peserta per sesi menyusul."],
  },
  {
    label: "Lokasi",
    value: siteConfig.venue,
    notes: [siteConfig.venueAddress, "Gladi resik dan wisuda diselenggarakan di lokasi yang sama."],
  },
  { label: "Pendaftaran & ketentuan", value: null },
];

export function InfoSection() {
  return (
    <section id="informasi" aria-labelledby="judul-informasi" className="scroll-mt-4 bg-[#f7f8f4]">
      <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <h2
          id="judul-informasi"
          className="text-[clamp(2.25rem,5vw,4.25rem)] font-extrabold leading-[1.08] tracking-[-0.045em] text-forest-900"
        >
          Informasi Wisuda
        </h2>

        <dl className="mt-8 border-y border-forest-900/20 sm:mt-10">
          {items.map((item, index) => (
            <RevealOnScroll
              key={item.label}
              className={`${styles.row} grid gap-1 py-5 sm:grid-cols-[minmax(12rem,0.4fr)_minmax(0,1fr)] sm:items-baseline sm:gap-8 sm:py-6 ${
                index > 0 ? "border-t border-forest-900/15" : ""
              }`}
            >
              <dt className={`${styles.label} font-semibold text-brand-green-deep`}>
                {item.label}
              </dt>
              {item.value ? (
                <dd className={`${styles.value} font-bold leading-snug text-forest-900`}>
                  {item.value}
                  {item.notes?.map((note) => (
                    <span key={note} className={`${styles.note} text-ink-muted`}>
                      {note}
                    </span>
                  ))}
                </dd>
              ) : (
                <dd className={`${styles.pending} text-ink-muted`}>Segera diumumkan</dd>
              )}
            </RevealOnScroll>
          ))}
        </dl>
      </div>
    </section>
  );
}
