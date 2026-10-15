export type Tone = "ok" | "duplicate" | "error";

interface Note {
  frequency: number;
  start: number;
  duration: number;
  type: OscillatorType;
}

const PATTERNS: Record<Tone, Note[]> = {
  // Satu bip tinggi singkat.
  ok: [{ frequency: 880, start: 0, duration: 0.12, type: "sine" }],
  // Dua bip sedang, agar terdengar berbeda dari "berhasil".
  duplicate: [
    { frequency: 620, start: 0, duration: 0.1, type: "triangle" },
    { frequency: 620, start: 0.18, duration: 0.1, type: "triangle" },
  ],
  // Satu nada rendah panjang.
  error: [{ frequency: 200, start: 0, duration: 0.55, type: "square" }],
};

/** Harus dibuat dari gestur pengguna (klik) agar diizinkan browser. Mengembalikan fungsi pemutar. */
export function createBeeper(): (tone: Tone) => void {
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return () => undefined;
  const context = new Ctor();
  return (tone) => {
    void context.resume();
    const now = context.currentTime;
    for (const note of PATTERNS[tone]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = note.type;
      oscillator.frequency.value = note.frequency;
      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(0.35, now + note.start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + note.start);
      oscillator.stop(now + note.start + note.duration + 0.02);
    }
  };
}
