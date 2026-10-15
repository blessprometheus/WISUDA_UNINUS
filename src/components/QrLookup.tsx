"use client";

import { useId, useState, type FormEvent } from "react";

interface LookupResult {
  nim: string;
  name: string;
  study_program: string;
  qr_url: string;
}

const MESSAGES: Record<number, string> = {
  404: "NIM tidak ditemukan dalam daftar wisudawan. Periksa kembali NIM Anda atau hubungi panitia.",
  422: "Format NIM tidak valid. Gunakan huruf, angka, titik, atau strip.",
  429: "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.",
};

export function QrLookup() {
  const inputId = useId();
  const errorId = useId();
  const [nim, setNim] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = nim.trim().toUpperCase();
    if (!value) {
      setError("Masukkan NIM Anda.");
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/v1/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nim: value }),
      });
      if (!response.ok) {
        setError(MESSAGES[response.status] ?? "Layanan sedang gangguan. Coba lagi nanti.");
        return;
      }
      const payload = (await response.json()) as { data: LookupResult };
      setResult(payload.data);
    } catch {
      setError("Tidak dapat terhubung ke layanan. Periksa koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-3">
        <label htmlFor={inputId} className="text-[15px] font-bold">
          Nomor Induk Mahasiswa (NIM)
        </label>
        <div className="flex flex-wrap gap-3">
          <input
            id={inputId}
            name="nim"
            value={nim}
            onChange={(event) => setNim(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={30}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="min-h-[52px] min-w-0 flex-[1_1_220px] rounded border-2 border-forest-900 bg-white px-4 text-lg font-semibold tracking-wide text-forest-900 placeholder:text-ink-muted"
            placeholder="Contoh: 10000000001"
          />
          <button
            type="submit"
            disabled={loading}
            className="min-h-[52px] rounded bg-forest-900 px-7 text-[15px] font-bold text-white hover:bg-forest-800 disabled:cursor-wait disabled:opacity-70"
          >
            {loading ? "Mencari…" : "Cari data saya"}
          </button>
        </div>
        <p id={errorId} role="alert" className="min-h-6 text-[15px] font-semibold text-red-800">
          {error}
        </p>
      </form>

      <div aria-live="polite">
        {result && (
          <article
            aria-label="Data wisudawan dan kartu QR"
            className="grid max-w-3xl gap-8 rounded border-2 border-forest-900 bg-white p-6 sm:grid-cols-[auto_1fr] sm:p-8"
          >
            {/* QR sengaja memakai <img> biasa: tautan bertanda tangan sekali-baca, tidak boleh dikodekan ulang. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.qr_url}
              alt={`Kode QR kehadiran untuk NIM ${result.nim}`}
              width={240}
              height={240}
              className="h-60 w-60 max-w-full justify-self-center bg-white"
            />
            <div className="flex flex-col justify-center gap-4">
              <dl className="flex flex-col gap-3">
                <div>
                  <dt className="text-[13px] font-bold uppercase tracking-[0.1em] text-ink-muted">
                    Nama
                  </dt>
                  <dd className="text-2xl font-extrabold leading-tight">{result.name}</dd>
                </div>
                <div>
                  <dt className="text-[13px] font-bold uppercase tracking-[0.1em] text-ink-muted">
                    Program studi
                  </dt>
                  <dd className="text-lg font-semibold">{result.study_program}</dd>
                </div>
                <div>
                  <dt className="text-[13px] font-bold uppercase tracking-[0.1em] text-ink-muted">
                    NIM
                  </dt>
                  <dd className="text-lg font-semibold tracking-wide">{result.nim}</dd>
                </div>
              </dl>
              <a
                href={result.qr_url}
                download={`QR-WISUDA-70-${result.nim}.png`}
                className="inline-flex min-h-[52px] items-center justify-center self-start rounded bg-gold px-7 text-[15px] font-bold text-forest-900 no-underline hover:bg-gold-soft"
              >
                Unduh QR
              </a>
              <p className="text-sm leading-6 text-ink-muted">
                Pastikan nama dan program studi sudah benar; bila keliru, hubungi panitia. Simpan
                gambar QR di HP agar dapat dibuka tanpa internet saat registrasi.
              </p>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
