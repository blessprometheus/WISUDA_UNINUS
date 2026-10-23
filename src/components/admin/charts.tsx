import { clockOf } from "@/components/admin/ui";

/**
 * Grafik ringan berbasis SVG/CSS (tanpa pustaka). Setiap grafik membawa angka dan teks yang dapat dibaca
 * (bukan hanya warna), dan transisinya dimatikan pada preferensi "kurangi gerakan".
 */

/** Cincin kemajuan: persentase di tengah, label teks tersedia untuk pembaca layar. */
export function ProgressRing({
  value,
  size = 168,
  stroke = 14,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${pct} persen ${label}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-white/15"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(circumference * pct) / 100} ${circumference}`}
          className="text-gold transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none"
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        aria-hidden="true"
      >
        <span className="text-4xl font-extrabold tabular-nums leading-none">{pct}%</span>
        <span className="mt-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-mist">
          {label}
        </span>
      </div>
    </div>
  );
}

/** Batang kemajuan dengan angka persen yang selalu terlihat (warna bukan satu-satunya penanda). */
export function ProgressBar({
  value,
  tone = "green",
  label,
}: {
  value: number;
  tone?: "green" | "gold" | "red";
  label: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const fill =
    tone === "red" ? "bg-[#b3261e]" : tone === "gold" ? "bg-[#c99a00]" : "bg-brand-green";
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-forest-900/10"
        role="img"
        aria-label={`${pct} persen ${label}`}
      >
        <div
          className={`h-full rounded-full ${fill} transition-[width] duration-500 ease-out motion-reduce:transition-none`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-11 text-right text-[13px] font-bold tabular-nums text-forest-900">
        {pct}%
      </span>
    </div>
  );
}

/** Diagram batang mini per interval waktu, dengan ringkasan teks dan daftar tersembunyi untuk pembaca layar. */
export function MiniBars({ data }: { data: ReadonlyArray<{ at: string; count: number }> }) {
  const rows = data.slice(-18);
  const max = Math.max(1, ...rows.map((row) => row.count));
  const peak = rows.reduce((best, row) => (row.count > best.count ? row : best), rows[0]!);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <div>
      <p className="text-[13px] text-ink-muted">
        <strong className="text-forest-900">{total}</strong> pemindaian · puncak{" "}
        <strong className="text-forest-900">{peak.count}</strong> pada {clockOf(peak.at)}
      </p>
      <div
        className="mt-3 flex h-32 items-end gap-1"
        role="img"
        aria-label={`Diagram pemindaian per 10 menit: total ${total}, puncak ${peak.count} pada ${clockOf(peak.at)}`}
      >
        {rows.map((row) => (
          <div
            key={row.at}
            title={`${clockOf(row.at)}: ${row.count}`}
            className="min-w-0 flex-1 rounded-t bg-brand-green transition-[height] duration-500 ease-out hover:bg-brand-green-deep motion-reduce:transition-none"
            style={{ height: `${Math.max(4, (row.count / max) * 100)}%` }}
          />
        ))}
      </div>
      <div
        className="mt-1 flex justify-between text-[12px] tabular-nums text-ink-muted"
        aria-hidden="true"
      >
        <span>{clockOf(rows[0]!.at)}</span>
        <span>{clockOf(rows[rows.length - 1]!.at)}</span>
      </div>
      <ul className="sr-only">
        {rows.map((row) => (
          <li key={row.at}>
            {clockOf(row.at)}: {row.count} pemindaian
          </li>
        ))}
      </ul>
    </div>
  );
}
