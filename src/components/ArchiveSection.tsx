import { ArchiveList } from "@/components/ArchiveList";
import { Reveal } from "@/components/motion/Reveal";

export function ArchiveSection() {
  return (
    <section
      id="arsip"
      aria-labelledby="judul-arsip"
      className="flex flex-wrap overflow-hidden bg-forest-900 text-white"
    >
      <div
        aria-hidden="true"
        className="flex min-h-[240px] flex-[1_1_420px] items-center justify-center bg-forest-800 p-12 sm:min-h-[480px]"
      >
        <Reveal scale={0.82} y={40}>
          <span className="block text-[clamp(160px,24vw,320px)] font-extrabold leading-[0.8] tracking-[-0.06em] text-gold opacity-90">
            69
          </span>
        </Reveal>
      </div>
      <div className="flex flex-[1_1_420px] flex-col justify-center gap-6 px-4 py-16 sm:px-12 lg:px-[72px] lg:py-24">
        <Reveal className="flex flex-col gap-6" x={32} y={0}>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-gold">Arsip</p>
          <h2
            id="judul-arsip"
            className="text-[clamp(40px,5vw,64px)] font-extrabold leading-none tracking-[-0.03em]"
          >
            Wisuda ke-69
          </h2>
          <p className="max-w-[440px] text-[17px] leading-7 text-mist">
            Galeri foto, e-book, dan survei kepuasan wisuda sebelumnya tetap dapat diakses.
          </p>
          <ArchiveList />
        </Reveal>
      </div>
    </section>
  );
}
