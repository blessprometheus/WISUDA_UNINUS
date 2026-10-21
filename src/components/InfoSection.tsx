import { infoItems } from "@/content/site";

export function InfoSection() {
  return (
    <section id="informasi" aria-labelledby="judul-informasi" className="scroll-mt-4 bg-[#f7f8f4]">
      <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
        <div className="grid gap-5 border-b border-forest-900/20 pb-8 sm:pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,25rem)] lg:items-end lg:gap-14">
          <div>
            <p className="mb-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-brand-green-deep sm:text-[13px]">
              <span aria-hidden="true" className="h-0.5 w-7 bg-gold" />
              Wisuda ke-70 / Informasi resmi
            </p>
            <h2
              id="judul-informasi"
              className="max-w-[15ch] text-[clamp(2.25rem,5vw,4.25rem)] font-extrabold leading-[1.05] tracking-[-0.045em] text-forest-900"
            >
              Informasi pelaksanaan
            </h2>
          </div>
          <p className="max-w-[42ch] text-[15px] leading-7 text-ink-muted sm:text-base">
            Rincian acara diperbarui mengikuti pengumuman resmi panitia. Informasi yang belum
            ditetapkan akan diumumkan di halaman ini.
          </p>
        </div>

        <dl className="border-b border-forest-900/20">
          {infoItems.map((item, index) => (
            <div
              key={item.label}
              className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4 border-t border-forest-900/15 py-5 first:border-t-0 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(14rem,0.9fr)] sm:items-baseline sm:gap-x-6 sm:py-7"
            >
              <span
                aria-hidden="true"
                className="pt-0.5 text-sm font-bold tabular-nums text-brand-green-deep"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <dt className="text-[17px] font-bold leading-snug text-forest-900 sm:text-xl">
                {item.label}
              </dt>
              <dd
                className={`col-start-2 mt-1.5 text-[15px] leading-6 sm:col-start-3 sm:mt-0 sm:text-[17px] sm:leading-7 ${
                  item.value ? "font-semibold text-forest-900" : "text-ink-muted"
                }`}
              >
                {item.value ?? "Segera diumumkan"}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-sm leading-6 text-ink-muted">
          Sumber: pengumuman resmi panitia Wisuda UNINUS.
        </p>
      </div>
    </section>
  );
}
