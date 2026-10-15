import { Reveal } from "@/components/motion/Reveal";
import { infoItems } from "@/content/site";

export function InfoSection() {
  return (
    <section
      id="informasi"
      aria-labelledby="judul-informasi"
      className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-20 sm:px-8 lg:px-12 lg:py-28"
    >
      <Reveal className="flex flex-wrap items-end justify-between gap-x-12 gap-y-4">
        <h2
          id="judul-informasi"
          className="max-w-[720px] text-[clamp(40px,6vw,72px)] font-extrabold leading-none tracking-[-0.03em]"
        >
          Informasi Pelaksanaan
        </h2>
        <p className="max-w-[360px] text-base leading-7 text-ink-muted">
          Rincian diperbarui setelah surat edaran resmi panitia terbit.
        </p>
      </Reveal>
      <dl className="grid border-t-2 border-forest-900 sm:grid-cols-2 lg:grid-cols-4">
        {infoItems.map((item, index) => (
          <Reveal
            key={item.label}
            className="flex flex-col gap-4 py-8 pr-6"
            delay={index * 0.09}
            y={36}
          >
            <span
              aria-hidden="true"
              className="text-[56px] font-extrabold leading-none text-brand-green-deep"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <dt className="text-[15px] font-bold uppercase tracking-[0.08em]">{item.label}</dt>
            <dd className={item.value ? "text-xl font-semibold" : "text-lg text-ink-muted"}>
              {item.value ?? "Segera diumumkan"}
            </dd>
          </Reveal>
        ))}
      </dl>
    </section>
  );
}
