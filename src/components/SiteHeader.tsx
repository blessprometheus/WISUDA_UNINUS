import Image from "next/image";
import Link from "next/link";
import { navLinks, siteConfig } from "@/content/site";

export function SiteHeader() {
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-8 lg:px-12">
      <Link
        href="/"
        className="flex items-center gap-3 text-white no-underline"
        aria-label={`UNINUS, beranda ${siteConfig.shortName}`}
      >
        <Image
          src="/brand/logo-uninus.png"
          alt=""
          width={36}
          height={50}
          className="h-auto w-9"
          priority
        />
        <span className="text-[15px] font-bold uppercase tracking-[0.06em]">UNINUS</span>
      </Link>
      <nav aria-label="Navigasi utama" className="flex flex-wrap gap-1">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex min-h-11 items-center px-3.5 text-[15px] font-semibold text-white no-underline hover:text-gold-soft"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
