"use client";

import { useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";

import { api, safeNext, type Profile } from "@/lib/api";

const COPY = {
  title: "Masuk Petugas",
  lead: "Gunakan akun yang dibuat oleh superadmin panitia.",
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function finish(userRole: Profile["user"]["role"]) {
    const fallback =
      userRole === "superadmin" ? "/admin" : userRole === "petugas" ? "/pemindai" : "/timeline";
    // Navigasi penuh (bukan router.replace): Next.js mempertahankan state halaman sebelumnya, sehingga data login
    // bisa tersisa di memori klien. Muat ulang membuang seluruh state.
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
      finish(res.data.user.role);
    });
  };

  return (
    <div className="w-full max-w-md">
      <h1 className="text-[clamp(28px,4vw,38px)] font-extrabold leading-tight tracking-tight text-forest-900">
        {COPY.title}
      </h1>
      <p className="mt-2 text-[16px] leading-7 text-ink-muted">{COPY.lead}</p>
      <div aria-hidden="true" className="my-6 h-0.5 w-14 bg-gold" />

      <p role="alert" className="mb-4 min-h-6 text-[15px] font-semibold text-[#b3261e]">
        {error}
      </p>

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
          Lupa kata sandi atau kehilangan akses? Hubungi superadmin panitia untuk membuat kata sandi
          baru.
        </p>
      </form>
    </div>
  );
}
