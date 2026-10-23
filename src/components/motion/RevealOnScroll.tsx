"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import styles from "@/components/motion/RevealOnScroll.module.css";

/**
 * Isi muncul saat digulir masuk ke layar, sekali, berurutan (tiap elemen punya pemicunya sendiri).
 *
 * Aturan (ADR-0011): efek hanya di desktop dengan pointer presisi dan tanpa preferensi "kurangi gerakan".
 * Di luar itu, dan sebelum hidrasi, dan tanpa JavaScript, isi LANGSUNG terlihat (state "static").
 * Isi selalu ada di HTML; hanya opasitas/posisi yang dianimasikan, jadi mesin pencari dan pembaca layar
 * tidak terpengaruh. Elemen yang sudah terlihat saat halaman dimuat (mis. tiba lewat tautan #informasi)
 * tidak disembunyikan.
 */
const DESKTOP =
  "(min-width: 48rem) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

type State = "static" | "hidden" | "shown";

export function RevealOnScroll({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("static");

  useEffect(() => {
    const element = ref.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const query = window.matchMedia(DESKTOP);
    let observer: IntersectionObserver | null = null;

    const apply = () => {
      observer?.disconnect();
      observer = null;
      if (!query.matches) {
        setState("static");
        return;
      }
      // Sudah (hampir) terlihat atau sudah terlewati: jangan disembunyikan.
      if (element.getBoundingClientRect().top < window.innerHeight * 0.85) {
        setState((current) => (current === "hidden" ? "shown" : current));
        return;
      }
      setState((current) => (current === "shown" ? current : "hidden"));
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setState("shown");
            observer?.disconnect();
          }
        },
        { threshold: 0.3, rootMargin: "0px 0px -10% 0px" },
      );
      observer.observe(element);
    };

    apply();
    query.addEventListener("change", apply);
    return () => {
      query.removeEventListener("change", apply);
      observer?.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={`${styles.item} ${className}`} data-state={state}>
      {children}
    </div>
  );
}
