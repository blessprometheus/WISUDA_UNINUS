"use client";

import { useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";

import { api, safeNext, type Profile } from "@/lib/api";

type Step = "credentials" | "code" | "setup" | "recovery";

interface SetupData {
  secret: string;
  qr_data_url: string;
}

const inputClass =
  "min-h-[52px] w-full rounded border-2 border-forest-line bg-forest-900 px-4 text-lg text-white placeholder:text-mist-dim focus:border-gold";
const buttonClass =
  "min-h-[52px] w-full rounded bg-gold px-6 text-[15px] font-bold text-forest-900 hover:bg-gold-soft disabled:cursor-wait disabled:opacity-70";

function Field({ label, children, id }: { label: string; children: ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[15px] font-bold">
        {label}
      </label>
      {children}
    </div>
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

  return (
    <div className="w-full max-w-md rounded-lg border border-forest-line bg-forest-800 p-6 shadow-xl sm:p-8">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-gold">Wisuda ke-70</p>
      <h1 className="mb-6 mt-2 text-3xl font-extrabold tracking-tight">Masuk Petugas</h1>

      <p role="alert" className="mb-4 min-h-6 text-[15px] font-semibold text-red-300">
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
            />
          </Field>
          <Field label="Kata sandi" id={passwordId}>
            <input
              id={passwordId}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </Field>
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? "Memeriksa…" : "Masuk"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={submitCode} className="flex flex-col gap-5">
          <p className="text-[15px] leading-6 text-mist">
            Masukkan kode 6 digit dari aplikasi authenticator Anda, atau salah satu kode pemulihan.
          </p>
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
          <p className="text-[15px] leading-6 text-mist">
            Akun superadmin wajib memakai verifikasi dua langkah. Pasang{" "}
            <strong>Google Authenticator</strong> atau
            <strong> Microsoft Authenticator</strong> di HP, pindai kode ini, lalu masukkan kode 6
            digit yang tampil.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={setup.qr_data_url}
            alt="Kode QR untuk aplikasi authenticator"
            width={240}
            height={240}
            className="mx-auto rounded bg-white p-2"
          />
          <p className="break-all text-center text-sm text-mist-dim">
            Tidak bisa memindai? Masukkan kunci ini secara manual:{" "}
            <span className="font-mono text-white">{setup.secret}</span>
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
          <p className="text-[15px] leading-6 text-mist">
            <strong className="text-gold">Simpan kode pemulihan ini sekarang</strong> di tempat aman
            (dicetak atau di pengelola kata sandi, terpisah dari HP). Setiap kode hanya berlaku
            sekali, dan tidak akan ditampilkan lagi.
          </p>
          <ul className="grid grid-cols-2 gap-2 rounded bg-forest-950 p-4 font-mono text-lg">
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
