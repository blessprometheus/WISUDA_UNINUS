import Image from "next/image";

import "./brand-loader.css";

type BrandLoaderProps = {
  label?: string;
  size?: "page" | "inline";
};

/** Indikator pemuatan ringan: logo UNINUS, tanpa JavaScript atau jeda buatan. */
export function BrandLoader({ label = "Memuat halaman", size = "page" }: BrandLoaderProps) {
  return (
    <div className={`brand-loader brand-loader--${size}`} role="status" aria-live="polite">
      <Image
        className="brand-loader__logo"
        src="/brand/logo-uninus.png"
        alt=""
        aria-hidden="true"
        width={128}
        height={176}
        sizes="(max-width: 767px) 100px, 128px"
        loading="eager"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
