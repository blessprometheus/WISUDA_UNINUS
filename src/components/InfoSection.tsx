import { siteConfig } from "@/content/site";

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
          <div className="grid gap-1 py-5 sm:grid-cols-[minmax(12rem,0.4fr)_minmax(0,1fr)] sm:items-baseline sm:gap-8 sm:py-6">
            <dt className="text-sm font-semibold text-brand-green-deep">Tanggal</dt>
            <dd className="text-[19px] font-bold leading-snug text-forest-900 sm:text-2xl">
              {siteConfig.eventDate}
            </dd>
          </div>
          <div className="grid gap-1 border-t border-forest-900/15 py-5 sm:grid-cols-[minmax(12rem,0.4fr)_minmax(0,1fr)] sm:items-baseline sm:gap-8 sm:py-6">
            <dt className="text-sm font-semibold text-brand-green-deep">Lokasi &amp; ketentuan</dt>
            <dd className="text-base leading-7 text-ink-muted">Segera diumumkan</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
