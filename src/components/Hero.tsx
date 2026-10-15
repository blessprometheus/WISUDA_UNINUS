import { Parallax } from "@/components/motion/Parallax";
import { SiteHeader } from "@/components/SiteHeader";
import { siteConfig } from "@/content/site";

/** Garis lengkung kubah bergaya logo, tergambar bertahap (CSS). Dekoratif, disembunyikan dari pembaca layar. */
function DomeLines() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 900"
      preserveAspectRatio="xMaxYMid slice"
      className="absolute right-[-4%] top-0 h-full w-[70%] max-w-[900px] opacity-55"
    >
      <path
        className="dome-draw"
        style={{ "--d": "0.2s" } as React.CSSProperties}
        pathLength={1}
        d="M60 900 V420 C60 280 260 170 400 40 C540 170 740 280 740 420 V900"
        fill="none"
        stroke="#ffcc29"
        strokeWidth="2"
      />
      <path
        className="dome-draw"
        style={{ "--d": "0.55s" } as React.CSSProperties}
        pathLength={1}
        d="M130 900 V440 C130 320 290 230 400 120 C510 230 670 320 670 440 V900"
        fill="none"
        stroke="#ffcc29"
        strokeWidth="1"
        opacity="0.6"
      />
      <path
        className="dome-draw"
        style={{ "--d": "0.9s" } as React.CSSProperties}
        pathLength={1}
        d="M200 900 V460 C200 360 320 290 400 200 C480 290 600 360 600 460 V900"
        fill="none"
        stroke="#ffcc29"
        strokeWidth="1"
        opacity="0.35"
      />
    </svg>
  );
}

function delay(seconds: number): React.CSSProperties {
  return { "--d": `${seconds}s` } as React.CSSProperties;
}

export function Hero() {
  return (
    <section
      id="beranda"
      aria-labelledby="judul-utama"
      className="relative flex min-h-[880px] flex-col overflow-hidden bg-forest-800 text-white"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,#14452f_0%,#0e3324_55%,#082418_100%)]"
      >
        <Parallax className="absolute inset-0" distance={160}>
          <DomeLines />
        </Parallax>
      </div>

      <SiteHeader />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl grow flex-col justify-end gap-7 px-4 pb-14 pt-12 sm:px-8 sm:pb-24 lg:px-12">
        <p
          className="fade-up text-sm font-bold uppercase tracking-[0.22em] text-gold"
          style={delay(0.05)}
        >
          {siteConfig.institution}
        </p>
        <h1
          id="judul-utama"
          className="flex flex-col font-extrabold leading-[0.88] tracking-[-0.04em]"
        >
          <span className="mask text-[clamp(40px,6vw,80px)]">
            <span className="rise" style={delay(0.1)}>
              Wisuda
            </span>
          </span>
          <span className="mask whitespace-nowrap text-[clamp(80px,22vw,300px)]">
            <span className="rise" style={delay(0.22)}>
              ke-<span className="text-gold">70</span>
            </span>
          </span>
        </h1>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="fade-up flex items-center gap-4" style={delay(0.7)}>
            <span aria-hidden="true" className="h-0.5 w-12 origin-left bg-gold" />
            <p className="text-[clamp(20px,2.4vw,26px)] font-semibold">{siteConfig.eventDate}</p>
          </div>
          <div className="fade-up flex flex-wrap gap-3" style={delay(0.85)}>
            <a
              href="#informasi"
              className="inline-flex min-h-[52px] items-center rounded bg-gold px-7 text-[15px] font-bold text-forest-900 no-underline hover:bg-gold-soft"
            >
              Lihat Informasi
            </a>
            <a
              href="/arsip/69"
              className="inline-flex min-h-[52px] items-center rounded border-2 border-white px-7 text-[15px] font-bold text-white no-underline hover:bg-white/10"
            >
              Arsip Wisuda ke-69
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
