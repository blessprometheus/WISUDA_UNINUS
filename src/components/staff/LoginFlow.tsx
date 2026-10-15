"use client";

import { useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";

import { api, safeNext, type Profile } from "@/lib/api";

type Step = "credentials" | "code" | "setup" | "recovery";

interface SetupData {
  secret: string;
  qr_data_url: string;
}

const TITLES: Record<Step, { title: string; lead: string }> = {
  credentials: {
    title: "Masuk Petugas",
    lead: "Gunakan akun yang dibuat oleh superadmin panitia.",
  },
  code: {
    title: "Verifikasi dua langkah",
    lead: "Masukkan kode 6 digit dari aplikasi authenticator Anda, atau salah satu kode pemulihan.",
  },
  setup: {
    title: "Aktifkan verifikasi dua langkah",
    lead: "Akun superadmin wajib memakai verifikasi dua langkah sebelum dapat dipakai.",
  },
  recovery: {
    title: "Simpan kode pemulihan",
    lead: "Kode ini satu-satunya jalan masuk bila HP Anda hilang.",
  },
};

const inputClass =
  "min-h-[52px] w-full rounded-md border-2 border-forest-900/25 bg-white px-4 text-lg text-forest-900 placeholder:text-ink-muted/70 focus:border-forest-900";
const buttonClass =
  "min-h-[52px] w-full rounded-md bg-forest-900 px-6 text-[15px] font-bold tracking-wide text-white shadow-sm hover:bg-forest-800 focus-visible:outline-gold disabled:cursor-wait disabled:opacity-70";

function Field({ label, children, id }: { label: string; children: ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-[14px] font-bold uppercase tracking-[0.08em] text-ink-muted"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

export function LoginFlow() {
  const params = useSearchParams();
  const emailId = useId();
  const passwordId = useId();
  const codeId = useId();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Profile["user"]["role"] | null>(null);
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  function finish(userRole: Profile["user"]["role"]) {
    const fallback =
      userRole === "superadmin" ? "/admin" : userRole === "petugas" ? "/pemindai" : "/";
    // Navigasi penuh (bukan router.replace): Next.js mempertahankan state halaman sebelumnya, sehingga kode pemulihan
    // atau data login bisa tersisa di memori klien. Muat ulang membuang seluruh state.
    window.location.assign(safeNext(params.get("next"), fallback));
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  const submitCredentials = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const res = await api<Profile>("POST", "/api/v1/auth/login", { email, password });
      if (!res.ok || !res.data) {
        setError(res.message ?? "Gagal masuk.");
        return;
      }
      setPassword("");
      setShowPassword(false);
      setRole(res.data.user.role);
      if (res.data.mfa.setup_required) {
        const started = await api<SetupData>("POST", "/api/v1/auth/2fa/setup");
        if (!started.ok || !started.data) {
          setError(started.message ?? "Tidak dapat memulai pendaftaran 2FA.");
          return;
        }
        setSetup(started.data);
        setStep("setup");
      } else if (res.data.mfa.enabled && !res.data.mfa.verified) {
        setStep("code");
      } else {
        finish(res.data.user.role);
      }
    });
  };

  const submitCode = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const res = await api<Profile>("POST", "/api/v1/auth/2fa/verify", { code });
      if (!res.ok) {
        setError(res.message ?? "Kode salah.");
        return;
      }
      setCode("");
      finish(role ?? "petugas");
    });
  };

  const submitSetup = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const res = await api<{ recovery_codes: string[] }>("POST", "/api/v1/auth/2fa/confirm", {
        code,
      });
      if (!res.ok || !res.data) {
        setError(res.message ?? "Kode salah.");
        return;
      }
      setCode("");
      setSetup(null);
      setRecoveryCodes(res.data.recovery_codes);
      setStep("recovery");
    });
  };

  const copy = TITLES[step];

  return (
    <div className="w-full max-w-md">
      <h1 className="text-[clamp(28px,4vw,38px)] font-extrabold leading-tight tracking-tight text-forest-900">
        {copy.title}
      </h1>
      <p className="mt-2 text-[16px] leading-7 text-ink-muted">{copy.lead}</p>
      <div aria-hidden="true" className="my-6 h-0.5 w-14 bg-gold" />

      <p role="alert" className="mb-4 min-h-6 text-[15px] font-semibold text-[#b3261e]">
        {error}
      </p>

      {step === "credentials" && (
        <form onSubmit={submitCredentials} className="flex flex-col gap-5">
          <Field label="Email" id={emailId}>
            <input
              id={emailId}
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="nama@uninus.ac.id"
            />
          </Field>
          <Field label="Kata sandi" id={passwordId}>
            <div className="relative">
              <input
                id={passwordId}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-14`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-label={showPassword ? "Sembunyikan sandi" : "Tampilkan sandi"}
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded text-ink-muted hover:text-forest-900"
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
          </Field>
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? "Memeriksa…" : "Masuk"}
          </button>
          <p className="text-[14px] leading-6 text-ink-muted">
            Lupa kata sandi atau kehilangan akses? Hubungi superadmin panitia untuk membuat kata
            sandi baru.
          </p>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={submitCode} className="flex flex-col gap-5">
          <Field label="Kode verifikasi" id={codeId}>
            <input
              id={codeId}
              inputMode="text"
              autoComplete="one-time-code"
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${inputClass} tracking-[0.3em]`}
            />
          </Field>
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? "Memeriksa…" : "Verifikasi"}
          </button>
        </form>
      )}

      {step === "setup" && setup && (
        <form onSubmit={submitSetup} className="flex flex-col gap-5">
          <p className="text-[15px] leading-6">
            Pasang <strong>Google Authenticator</strong> atau{" "}
            <strong>Microsoft Authenticator</strong> di HP, pindai kode ini, lalu masukkan kode 6
            digit yang tampil.{" "}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={setup.qr_data_url}
            alt="Kode QR untuk aplikasi authenticator"
            width={220}
            height={220}
            className="mx-auto rounded-md border border-forest-900/15 bg-white p-2 shadow-sm"
          />
          <p className="break-all text-center text-sm text-ink-muted">
            Tidak bisa memindai? Masukkan kunci ini secara manual:{" "}
            <span className="font-mono text-forest-900">{setup.secret}</span>
          </p>
          <Field label="Kode 6 digit" id={codeId}>
            <input
              id={codeId}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${inputClass} tracking-[0.3em]`}
            />
          </Field>
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? "Memeriksa…" : "Aktifkan 2FA"}
          </button>
        </form>
      )}

      {step === "recovery" && (
        <div className="flex flex-col gap-5">
          <p className="text-[15px] leading-6">
            <strong className="text-[#8a6a00]">Simpan kode pemulihan ini sekarang</strong> di tempat
            aman (dicetak atau di pengelola kata sandi, terpisah dari HP). Setiap kode hanya berlaku
            sekali, dan tidak akan ditampilkan lagi.
          </p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-forest-900 p-4 font-mono text-lg text-white">
            {recoveryCodes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => finish(role ?? "superadmin")}
            className={buttonClass}
          >
            Saya sudah menyimpan kodenya
          </button>
        </div>
      )}
    </div>
  );
}
