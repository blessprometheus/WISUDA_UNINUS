import { SiteHeader } from "@/components/SiteHeader";
import { qrEnabled, siteConfig } from "@/content/site";

function delay(seconds: number): React.CSSProperties {
  return { "--d": `${seconds}s` } as React.CSSProperties;
}

/** Garis lengkung kubah bergaya logo, tergambar bertahap (CSS). Dekoratif, disembunyikan dari pembaca layar. */
function DomeLines() {
  const lines = [
    { d: "M60 900 V420 C60 280 260 170 400 40 C540 170 740 280 740 420 V900", w: 2, o: 1, at: 0.2 },
    {
      d: "M130 900 V440 C130 320 290 230 400 120 C510 230 670 320 670 440 V900",
      w: 1,
      o: 0.6,
      at: 0.55,
    },
    {
      d: "M200 900 V460 C200 360 320 290 400 200 C480 290 600 360 600 460 V900",
      w: 1,
      o: 0.35,
      at: 0.9,
    },
  ];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 900"
      preserveAspectRatio="xMaxYMid slice"
      className="absolute right-[-4%] top-0 h-full w-[70%] max-w-[900px] opacity-55"
    >
      {lines.map((line) => (
        <path
          key={line.d}
          className="dome-draw"
          style={delay(line.at)}
          pathLength={1}
          d={line.d}
          fill="none"
          stroke="#ffcc29"
          strokeWidth={line.w}
          opacity={line.o}
        />
      ))}
    </svg>
  );
}

/** Huruf muncul satu per satu dari balik topeng. Hanya visual; nama aksesibel ada di <h1 aria-label>. */
function Letters({ text, start }: { text: string; start: number }) {
  return (
    <>
      {Array.from(text).map((char, index) => (
        <span key={index} className="rise" style={delay(start + index * 0.04)}>
          {char}
        </span>
      ))}
    </>
  );
}

/** Angka 70 berputar seperti odometer (puluhan 0→7, satuan 0→9→0), lalu berkilau emas sekali. */
function Odometer() {
  const tens = Array.from({ length: 8 }, (_, n) => n); // 0..7
  const ones = [...Array.from({ length: 10 }, (_, n) => n), 0]; // 0..9 lalu 0
  return (
    <span className="odo gold-shine">
      <span className="odo-col">
        <span className="odo-strip odo-tens">
          {tens.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </span>
      </span>
      <span className="odo-col">
        <span className="odo-strip odo-ones">
          {ones.map((n, i) => (
            <span key={i}>{n}</span>
          ))}
        </span>
      </span>
    </span>
  );
}

export function Hero() {
  return (
    <section
      id="beranda"
      aria-labelledby="judul-utama"
      className="relative flex min-h-[min(760px,100svh)] flex-col overflow-hidden bg-forest-800 text-white sm:min-h-[880px]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,#14452f_0%,#0e3324_55%,#082418_100%)]"
      >
        <div className="absolute inset-0">
          <DomeLines />
        </div>
        <div className="hero-glow absolute bottom-[4%] left-0 h-[62%] w-[78%]" />
      </div>

      <SiteHeader />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl grow flex-col justify-end gap-5 px-5 pb-12 pt-8 sm:gap-7 sm:px-8 sm:pb-24 sm:pt-12 lg:px-12">
        <p
          className="fade-up text-sm font-bold uppercase tracking-[0.22em] text-gold"
          style={delay(0.05)}
        >
          {siteConfig.institution}
        </p>
        {/* <h1> berisi teks bersih untuk mesin pencari dan pembaca layar; visual animasi ada di blok aria-hidden. */}
        <h1 id="judul-utama" className="sr-only">
          Wisuda ke-70
        </h1>
        <div
          aria-hidden="true"
          className="flex flex-col font-extrabold leading-[0.88] tracking-[-0.04em]"
        >
          <span className="mask text-[clamp(38px,6vw,80px)]">
            <Letters text="Wisuda" start={0.05} />
          </span>
          <span className="mask whitespace-nowrap text-[clamp(72px,20vw,300px)]">
            <Letters text="ke-" start={0.2} />
            <Odometer />
          </span>
        </div>
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-4">
          <div className="fade-up flex items-center gap-4" style={delay(0.75)}>
            <span aria-hidden="true" className="h-0.5 w-12 origin-left bg-gold" />
            <div>
              <p className="text-[clamp(17px,2.4vw,26px)] font-semibold">{siteConfig.eventDate}</p>
              <p className="mt-1 text-[15px] text-white/80">
                {siteConfig.venue}, Bandung · dua sesi: pagi dan siang
              </p>
            </div>
          </div>
          <div
            className="fade-up flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap"
            style={delay(0.9)}
          >
            <a
              href="#informasi"
              className="inline-flex min-h-[52px] w-full items-center justify-center rounded bg-gold px-7 text-[15px] font-bold text-forest-900 no-underline hover:bg-gold-soft sm:w-auto sm:min-w-[172px]"
            >
              Lihat Informasi
            </a>
            {qrEnabled && (
              <>
                <a
                  href="/pendaftaran"
                  className="inline-flex min-h-[52px] w-full items-center justify-center rounded border-2 border-gold bg-forest-900/70 px-7 text-[15px] font-bold text-gold no-underline hover:bg-forest-900 sm:w-auto sm:min-w-[172px]"
                >
                  Daftar Wisuda
                </a>
                <a
                  href="#kartu-qr"
                  className="inline-flex min-h-[52px] w-full items-center justify-center rounded bg-gold px-7 text-[15px] font-bold text-forest-900 no-underline hover:bg-gold-soft sm:w-auto sm:min-w-[172px]"
                >
                  Cari NIM
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
