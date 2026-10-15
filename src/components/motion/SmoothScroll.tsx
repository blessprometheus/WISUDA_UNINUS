"use client";

import Lenis from "lenis";
import { useEffect } from "react";

/**
 * Gulir halus (Lenis). Dimatikan bila pengguna memilih "kurangi gerakan" (prefers-reduced-motion).
 * Tautan anchor (#informasi, dst.) ikut digulir halus. Scrollbar asli tidak diganti.
 */
export function SmoothScroll() {
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lenis: Lenis | null = null;

    const apply = () => {
      lenis?.destroy();
      lenis = null;
      if (query.matches) return;
      lenis = new Lenis({ duration: 1.15, smoothWheel: true, anchors: true, autoRaf: true });
    };

    apply();
    query.addEventListener("change", apply);
    return () => {
      query.removeEventListener("change", apply);
      lenis?.destroy();
    };
  }, []);

  return null;
}
