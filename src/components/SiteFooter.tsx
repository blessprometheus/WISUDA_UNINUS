import Image from "next/image";
import { officialLinks, siteConfig } from "@/content/site";

export function SiteFooter() {
  return (
    <footer id="kontak" className="bg-forest-950 text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-end justify-between gap-8 px-5 pb-8 pt-12 sm:px-8 sm:pt-14 lg:px-12">
        <div className="flex flex-col gap-4">
          <Image
            src="/brand/logo-uninus.png"
            alt="Logo Universitas Islam Nusantara"
            width={48}
            height={66}
            className="h-auto w-12"
          />
          <span className="text-xl font-extrabold tracking-tight sm:text-[22px]">
            Panitia {siteConfig.shortName}
          </span>
          <span className="text-sm text-mist-dim">{siteConfig.institution}</span>
        </div>
        <nav aria-label="Tautan resmi" className="flex flex-wrap gap-x-6 gap-y-2">
          {officialLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-[15px] font-semibold text-white underline-offset-4 hover:underline"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="mx-auto w-full max-w-7xl border-t border-white/10 px-5 pb-8 pt-5 text-[13px] text-mist-dim sm:px-8 lg:px-12">
        © 2026 {siteConfig.institution}
      </div>
    </footer>
  );
}
