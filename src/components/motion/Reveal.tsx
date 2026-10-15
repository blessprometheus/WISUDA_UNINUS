"use client";

import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Detik. */
  delay?: number;
  y?: number;
  x?: number;
  scale?: number;
}

/**
 * Muncul halus saat digulir ke dalam layar (sekali). Konten selalu ada di HTML;
 * tanpa JavaScript atau dengan "kurangi gerakan" langsung terlihat (lihat <noscript> di layout).
 */
export function Reveal({ children, className, delay = 0, y = 28, x = 0, scale = 1 }: RevealProps) {
  const reduce = useReducedMotion();
  return (
    <m.div
      data-reveal
      className={className}
      initial={reduce ? false : { opacity: 0, y, x, scale }}
      whileInView={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}
