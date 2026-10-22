import { QrLookup } from "@/components/QrLookup";

export function QrSection() {
  return (
    <section
      id="kartu-qr"
      aria-labelledby="judul-kartu-qr"
      className="border-y border-forest-900/10 bg-mist-bg"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-5 py-14 sm:gap-9 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <div className="flex max-w-3xl flex-col gap-3">
          <h2
            id="judul-kartu-qr"
            className="text-[clamp(32px,5vw,64px)] font-extrabold leading-[1.08] tracking-[-0.03em]"
          >
            Kartu QR Kehadiran
          </h2>
          <p className="text-base leading-7 text-ink-muted sm:text-[17px]">
            Masukkan NIM untuk melihat dan mengunduh kartu QR Anda.
          </p>
        </div>
        <QrLookup />
      </div>
    </section>
  );
}
