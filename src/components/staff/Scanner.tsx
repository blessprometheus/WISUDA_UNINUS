"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { api, type Profile } from "@/lib/api";
import { createBeeper, type Tone } from "@/lib/beep";

interface SessionInfo {
  id: number;
  name: string;
  window_open: boolean;
}
interface Context {
  active_session: SessionInfo | null;
}
interface ScanResponse {
  result:
    "recorded" | "duplicate" | "unknown" | "not_active" | "outside_window" | "inactive_student";
  message: string;
  student: { nim: string; name: string; study_program: string } | null;
  scanned_at?: string | null;
  outside_window?: boolean;
}
interface RecentRow {
  nim: string;
  name: string;
  study_program: string;
  scanned_at: string;
  method: "qr" | "manual";
  outside_window: boolean;
}

type Display =
  | { kind: "idle" }
  | {
      kind: "ok" | "duplicate" | "error";
      title: string;
      name?: string;
      program?: string;
      detail?: string;
    };

const HOLD_MS = 2000;

/** Navigasi penuh agar seluruh state klien (nama petugas, riwayat, kode) terbuang saat keluar/login ulang. */
function goToLogin(next?: string): void {
  window.location.assign(next ? `/masuk?next=${encodeURIComponent(next)}` : "/masuk");
}
const TOKEN = /^[0-9a-f]{32}$/i;
const DESKS = ["Meja 1", "Meja 2", "Meja 3", "Meja 4", "Lainnya"] as const;
const DESK_KEY = "wisuda-meja";

const PANEL: Record<Display["kind"], string> = {
  idle: "bg-forest-900 text-white",
  ok: "bg-[#0b7a3e] text-white",
  duplicate: "bg-[#f5c518] text-black",
  error: "bg-[#b3261e] text-white",
};

function clock(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

function toDisplay(res: ScanResponse): { display: Display; tone: Tone } {
  const s = res.student;
  switch (res.result) {
    case "recorded":
      return {
        tone: "ok",
        display: {
          kind: "ok",
          title: "HADIR",
          name: s?.name,
          program: s?.study_program,
          ...(res.outside_window ? { detail: "Dicatat di luar jam sesi (manual)" } : {}),
        },
      };
    case "duplicate":
      return {
        tone: "duplicate",
        display: {
          kind: "duplicate",
          title: "SUDAH HADIR",
          name: s?.name,
          program: s?.study_program,
          detail: `Tercatat pukul ${clock(res.scanned_at)}`,
        },
      };
    case "outside_window":
      return {
        tone: "error",
        display: {
          kind: "error",
          title: "DI LUAR JAM SCAN",
          detail: "Gunakan input NIM manual di bawah.",
        },
      };
    case "inactive_student":
      return {
        tone: "error",
        display: {
          kind: "error",
          title: "WISUDAWAN NONAKTIF",
          name: s?.name,
          detail: "Hubungi superadmin.",
        },
      };
    case "not_active":
      return {
        tone: "error",
        display: {
          kind: "error",
          title: "SESI BELUM AKTIF",
          detail: "Minta superadmin mengaktifkan sesi.",
        },
      };
    default:
      return {
        tone: "error",
        display: { kind: "error", title: "TIDAK DIKENAL", detail: res.message },
      };
  }
}

export function Scanner() {
  const [phase, setPhase] = useState<"loading" | "gate" | "running" | "forbidden">("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [desk, setDesk] = useState<string>("Meja 1");
  const [soundOn, setSoundOn] = useState(true);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [display, setDisplay] = useState<Display>({ kind: "idle" });
  const [scanValue, setScanValue] = useState("");
  const [manualNim, setManualNim] = useState("");
  const [offerNim, setOfferNim] = useState<string | null>(null);
  const [offerName, setOfferName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [count, setCount] = useState(0);

  const scanRef = useRef<HTMLInputElement>(null);
  const beepRef = useRef<((tone: Tone) => void) | null>(null);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const sessionRef = useRef<SessionInfo | null>(null);

  const focusScan = useCallback(() => scanRef.current?.focus(), []);

  // Pemeriksaan sesi login + peran.
  useEffect(() => {
    void (async () => {
      const me = await api<Profile>("GET", "/api/v1/auth/me");
      if (!me.ok || !me.data || !me.data.mfa.verified) {
        goToLogin("/pemindai");
        return;
      }
      setProfile(me.data);
      if (me.data.user.role !== "petugas" && me.data.user.role !== "superadmin") {
        setPhase("forbidden");
        return;
      }
      try {
        const saved = window.localStorage.getItem(DESK_KEY);
        if (saved && (DESKS as readonly string[]).includes(saved)) setDesk(saved);
      } catch {
        // penyimpanan tidak tersedia
      }
      setPhase("gate");
    })();
  }, []);

  const refreshContext = useCallback(async () => {
    const res = await api<Context>("GET", "/api/v1/scan/context");
    if (res.status === 401) {
      goToLogin("/pemindai");
      return;
    }
    if (res.ok && res.data) {
      sessionRef.current = res.data.active_session;
      setSession(res.data.active_session);
    }
  }, []);

  const refreshRecent = useCallback(async () => {
    const id = sessionRef.current?.id;
    if (!id) return;
    const res = await api<RecentRow[]>("GET", `/api/v1/scan/recent?session_id=${id}&limit=10`);
    if (res.ok && res.data) setRecent(res.data);
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    void (async () => {
      await refreshContext();
      await refreshRecent();
    })();
    const timer = setInterval(() => void refreshContext(), 30_000);
    return () => clearInterval(timer);
  }, [phase, refreshContext, refreshRecent]);

  const show = useCallback(
    (next: Display, tone?: Tone) => {
      if (holdRef.current) clearTimeout(holdRef.current);
      setDisplay(next);
      if (tone && soundOn) beepRef.current?.(tone);
      holdRef.current = setTimeout(() => setDisplay({ kind: "idle" }), HOLD_MS);
    },
    [soundOn],
  );

  // Antrean berurutan: hasil tidak saling menimpa walau scanner menembak cepat.
  const enqueue = useCallback((job: () => Promise<void>) => {
    queueRef.current = queueRef.current.then(job, job);
  }, []);

  const post = useCallback(
    async (kind: "qr" | "manual", value: string) => {
      const current = sessionRef.current;
      if (!current) {
        show(
          {
            kind: "error",
            title: "SESI BELUM AKTIF",
            detail: "Minta superadmin mengaktifkan sesi.",
          },
          "error",
        );
        return;
      }
      const body =
        kind === "qr"
          ? { session_id: current.id, token: value, device_label: desk }
          : { session_id: current.id, nim: value, device_label: desk };
      const res = await api<ScanResponse>(
        "POST",
        kind === "qr" ? "/api/v1/scan" : "/api/v1/scan/manual",
        body,
      );
      if (res.status === 401) {
        goToLogin("/pemindai");
        return;
      }
      if (!res.ok || !res.data) {
        const offline = res.status === 0;
        show(
          {
            kind: "error",
            title: offline
              ? "TIDAK TERHUBUNG"
              : res.status === 422
                ? "KODE TIDAK DIKENAL"
                : "GANGGUAN LAYANAN",
            detail: offline
              ? "Catat di daftar cetak, lalu coba lagi."
              : (res.message ?? "Coba lagi."),
          },
          "error",
        );
        return;
      }
      const { display: next, tone } = toDisplay(res.data);
      show(next, tone);
      if (res.data.result === "recorded") setCount((n) => n + 1);
      if (kind === "manual" && res.data.result === "unknown") {
        setOfferNim(value);
        setOfferName("");
      } else {
        setOfferNim(null);
      }
      await refreshRecent();
    },
    [desk, refreshRecent, show],
  );

  const onScan = (event: FormEvent) => {
    event.preventDefault();
    const value = scanValue.trim();
    setScanValue("");
    if (!value) return;
    if (!TOKEN.test(value)) {
      show(
        {
          kind: "error",
          title: "KODE TIDAK DIKENAL",
          detail: "Bukan kode QR wisudawan. Gunakan input NIM manual.",
        },
        "error",
      );
      return;
    }
    enqueue(() => post("qr", value));
  };

  const onManual = (event: FormEvent) => {
    event.preventDefault();
    const value = manualNim.trim().toUpperCase();
    if (!value) return;
    setManualNim("");
    enqueue(() => post("manual", value));
    focusScan();
  };

  const submitUnregistered = async () => {
    const current = sessionRef.current;
    if (!current || !offerNim) return;
    const res = await api<{ message: string }>("POST", "/api/v1/scan/unregistered", {
      session_id: current.id,
      nim: offerNim,
      name: offerName.trim(),
    });
    setNotice(
      res.ok
        ? `NIM ${offerNim} dicatat sebagai tidak terdaftar (tidak dihitung hadir).`
        : (res.message ?? "Gagal mencatat."),
    );
    setOfferNim(null);
    focusScan();
  };

  const start = () => {
    try {
      window.localStorage.setItem(DESK_KEY, desk);
    } catch {
      // abaikan
    }
    beepRef.current = soundOn ? createBeeper() : null;
    if (soundOn) beepRef.current?.("ok");
    setPhase("running");
  };

  useEffect(() => {
    if (phase === "running") focusScan();
  }, [phase, focusScan]);

  const logout = async () => {
    await api("POST", "/api/v1/auth/logout");
    goToLogin();
  };

  if (phase === "loading") {
    return <p className="p-8 text-xl">Memeriksa sesi…</p>;
  }
  if (phase === "forbidden") {
    return (
      <div className="mx-auto max-w-xl p-8">
        <h1 className="text-3xl font-extrabold">Akses ditolak</h1>
        <p className="mt-3 text-lg text-mist">
          Akun Anda tidak memiliki izin untuk halaman pemindai.
        </p>
        <button
          type="button"
          onClick={logout}
          className="mt-6 min-h-[52px] rounded bg-gold px-6 font-bold text-forest-900"
        >
          Keluar
        </button>
      </div>
    );
  }
  if (phase === "gate") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-6">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-gold">Wisuda ke-70</p>
        <h1 className="text-4xl font-extrabold tracking-tight">Pemindai Kehadiran</h1>
        <p className="text-mist">
          Masuk sebagai {profile?.user.name}. Pilih meja Anda, lalu mulai bertugas.
        </p>
        <label className="flex flex-col gap-2 text-[15px] font-bold">
          Meja / titik scanner
          <select
            value={desk}
            onChange={(e) => setDesk(e.target.value)}
            className="min-h-[52px] rounded border-2 border-forest-line bg-forest-900 px-4 text-lg"
          >
            {DESKS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 text-[15px] font-semibold">
          <input
            type="checkbox"
            checked={soundOn}
            onChange={(e) => setSoundOn(e.target.checked)}
            className="h-6 w-6 accent-[#ffcc29]"
          />
          Aktifkan bunyi (bip berbeda untuk hadir, sudah hadir, dan gagal)
        </label>
        <button
          type="button"
          onClick={start}
          className="min-h-[60px] rounded bg-gold px-6 text-lg font-extrabold text-forest-900 hover:bg-gold-soft"
        >
          Mulai bertugas
        </button>
        <button
          type="button"
          onClick={logout}
          className="min-h-11 text-sm font-semibold text-mist underline"
        >
          Keluar
        </button>
      </div>
    );
  }

  const windowClosed = session !== null && !session.window_open;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-forest-line px-4 py-3 text-sm sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <strong className="text-gold">{desk}</strong>
          <span>{session ? session.name : "Belum ada sesi aktif"}</span>
          <span className="text-mist">Dicatat meja ini: {count}</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            aria-pressed={soundOn}
            className="min-h-11 font-semibold underline"
          >
            Bunyi: {soundOn ? "nyala" : "mati"}
          </button>
          <button type="button" onClick={logout} className="min-h-11 font-semibold underline">
            Keluar
          </button>
        </div>
      </header>

      {!session && (
        <p role="alert" className="bg-[#b3261e] px-6 py-3 text-lg font-bold">
          Belum ada sesi aktif. Minta superadmin mengaktifkan sesi gladi/hari-H.
        </p>
      )}
      {windowClosed && (
        <p role="status" className="bg-[#f5c518] px-6 py-3 text-lg font-bold text-black">
          Di luar jam scan QR sesi ini. QR ditolak; gunakan input NIM manual.
        </p>
      )}

      <section
        role="status"
        aria-live="assertive"
        aria-label="Hasil pemindaian"
        className={`flex min-h-[46vh] flex-1 flex-col items-center justify-center gap-4 px-6 py-8 text-center ${PANEL[display.kind]}`}
      >
        {display.kind === "idle" ? (
          <>
            <p className="text-[clamp(36px,6vw,80px)] font-extrabold leading-none tracking-tight">
              SIAP MEMINDAI
            </p>
            <p className="text-xl opacity-80">Arahkan scanner ke QR di layar HP wisudawan.</p>
          </>
        ) : (
          <>
            <p className="text-[clamp(36px,6vw,72px)] font-extrabold leading-none tracking-tight">
              {display.title}
            </p>
            {display.name && (
              <p className="text-[clamp(40px,8vw,110px)] font-extrabold leading-[1.05]">
                {display.name}
              </p>
            )}
            {display.program && (
              <p className="text-[clamp(22px,3vw,40px)] font-semibold">{display.program}</p>
            )}
            {display.detail && (
              <p className="text-[clamp(18px,2.4vw,30px)] font-semibold">{display.detail}</p>
            )}
          </>
        )}
      </section>

      <div className="grid gap-6 border-t border-forest-line p-4 sm:p-6 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-5">
          <form onSubmit={onScan}>
            <label
              htmlFor="scan"
              className="text-[13px] font-bold uppercase tracking-[0.1em] text-mist-dim"
            >
              Kolom scanner (terisi otomatis)
            </label>
            <input
              id="scan"
              ref={scanRef}
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onBlur={() =>
                setTimeout(() => document.activeElement === document.body && focusScan(), 50)
              }
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="mt-1 min-h-[52px] w-full rounded border-2 border-gold bg-forest-900 px-4 font-mono text-lg"
              placeholder="Fokus di sini; scanner mengetik lalu Enter"
            />
          </form>

          <form onSubmit={onManual} className="flex flex-col gap-2">
            <label
              htmlFor="manual"
              className="text-[13px] font-bold uppercase tracking-[0.1em] text-mist-dim"
            >
              Input NIM manual (cadangan bila QR sulit terbaca)
            </label>
            <div className="flex gap-3">
              <input
                id="manual"
                value={manualNim}
                onChange={(e) => setManualNim(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={30}
                className="min-h-[52px] min-w-0 flex-1 rounded border-2 border-forest-line bg-forest-900 px-4 text-lg"
                placeholder="NIM"
              />
              <button
                type="submit"
                className="min-h-[52px] rounded bg-mist px-6 font-bold text-forest-900 hover:bg-white"
              >
                Catat manual
              </button>
            </div>
          </form>

          {notice && (
            <p role="status" className="rounded bg-forest-800 p-3 text-[15px] font-semibold">
              {notice}
            </p>
          )}
          {offerNim && (
            <div className="flex flex-col gap-3 rounded border-2 border-[#f5c518] p-4">
              <p className="font-bold">
                NIM {offerNim} tidak ditemukan. Catat sebagai &quot;tidak terdaftar&quot;? (tidak
                dihitung hadir)
              </p>
              <input
                value={offerName}
                onChange={(e) => setOfferName(e.target.value)}
                maxLength={160}
                aria-label="Nama (opsional)"
                placeholder="Nama (opsional)"
                className="min-h-[48px] rounded border-2 border-forest-line bg-forest-900 px-4"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={submitUnregistered}
                  className="min-h-[48px] rounded bg-[#f5c518] px-5 font-bold text-black"
                >
                  Catat tidak terdaftar
                </button>
                <button
                  type="button"
                  onClick={() => setOfferNim(null)}
                  className="min-h-[48px] px-4 font-semibold underline"
                >
                  Abaikan
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-mist-dim">
            10 terakhir (semua meja)
          </h2>
          <ul className="mt-2 divide-y divide-forest-line">
            {recent.length === 0 && <li className="py-2 text-mist-dim">Belum ada.</li>}
            {recent.map((row) => (
              <li
                key={`${row.nim}-${row.scanned_at}`}
                className="flex items-baseline justify-between gap-3 py-2"
              >
                <span className="min-w-0 truncate font-semibold">{row.name}</span>
                <span className="shrink-0 text-sm text-mist">
                  {clock(row.scanned_at)} · {row.method === "manual" ? "manual" : "QR"}
                  {row.outside_window ? " · di luar jam" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
