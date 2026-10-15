"use client";

import { useReducedMotion, useScroll, useTransform } from "motion/react";
import * as m from "motion/react-m";
import type { ReactNode } from "react";

/** Menggeser anak lebih lambat daripada gulir halaman (kesan kedalaman). Statis bila kurangi gerakan. */
export function Parallax({
  children,
  className,
  distance = 140,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
}) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 800], [0, reduce ? 0 : distance]);
  return (
    <m.div className={className} style={{ y }}>
      {children}
    </m.div>
  );
}
