import { QrLookup } from "@/components/QrLookup";

export function QrSection() {
  return (
    <section
      id="kartu-qr"
      aria-labelledby="judul-kartu-qr"
      className="border-y border-forest-900/10 bg-mist-bg"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="flex max-w-3xl flex-col gap-4">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-brand-green-deep">
            Untuk wisudawan
          </p>
          <h2
            id="judul-kartu-qr"
            className="text-[clamp(36px,5vw,64px)] font-extrabold leading-none tracking-[-0.03em]"
          >
            Kartu QR Kehadiran
          </h2>
          <p className="text-[17px] leading-7 text-ink-muted">
            Masukkan NIM untuk memeriksa data Anda dan mengunduh kode QR. Tunjukkan QR dari layar HP
            kepada petugas saat gladi resik dan hari pelaksanaan.
          </p>
        </div>
        <QrLookup />
      </div>
    </section>
  );
}
