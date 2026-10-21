import Image from "next/image";
import Link from "next/link";
import { navLinks, siteConfig } from "@/content/site";

export function SiteHeader() {
  return (
    <header className="relative z-10 mx-auto grid w-full max-w-7xl gap-4 px-5 pb-4 pt-5 sm:flex sm:items-center sm:justify-between sm:px-8 sm:py-6 lg:px-12">
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
          className="h-auto w-8 sm:w-9"
          priority
        />
        <span className="text-[15px] font-bold uppercase tracking-[0.06em]">UNINUS</span>
      </Link>
      <nav
        aria-label="Navigasi utama"
        className="grid grid-cols-2 gap-1 border-t border-white/20 pt-3 min-[380px]:grid-cols-4 sm:flex sm:flex-wrap sm:border-0 sm:pt-0"
      >
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex min-h-11 items-center justify-center px-2 text-[13px] font-semibold text-white no-underline hover:text-gold-soft sm:px-3.5 sm:text-[15px]"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
