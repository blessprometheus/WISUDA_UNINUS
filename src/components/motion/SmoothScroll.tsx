"use client";

import { useEffect } from "react";

/**
 * Gulir halus hanya untuk desktop dengan pointer presisi dan tanpa preferensi kurangi gerakan.
 * Tautan anchor (#informasi, dst.) ikut digulir halus. Scrollbar asli tidak diganti.
 */
export function SmoothScroll() {
  useEffect(() => {
    const query = window.matchMedia(
      "(prefers-reduced-motion: reduce), (pointer: coarse), (max-width: 767px)",
    );
    let lenis: import("lenis").default | null = null;
    let generation = 0;

    const apply = async () => {
      const current = ++generation;
      lenis?.destroy();
      lenis = null;
      if (query.matches) return;
      const { default: Lenis } = await import("lenis");
      if (current !== generation) return;
      lenis = new Lenis({ duration: 1.15, smoothWheel: true, anchors: true, autoRaf: true });
    };

    void apply();
    query.addEventListener("change", apply);
    return () => {
      query.removeEventListener("change", apply);
      generation++;
      lenis?.destroy();
    };
  }, []);

  return null;
}
