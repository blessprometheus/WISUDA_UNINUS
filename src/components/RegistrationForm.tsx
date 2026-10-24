"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState, type ChangeEvent, type FormEvent } from "react";

interface ExistingForm {
  gender: string | null;
  toga_size: string | null;
  birth_place: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  gpa: string | null;
  graduation_date: string | null;
  thesis_title: string | null;
}

interface VerifiedStudent {
  nim: string;
  name: string;
  study_program: string;
  cohort_year: number | null;
  graduation_date_text: string | null;
  is_paid: boolean;
  is_yudisium: boolean;
  registration_status: string;
  registered_at: string | null;
  qr_url: string;
  existing_form: ExistingForm | null;
}

interface VerifyResponse {
  status: "success" | "failed_verification" | "not_found";
  message: string;
  reasons?: string[];
  data?: VerifiedStudent;
}

const TOGA_OPTIONS = [
  { value: "M", label: "M (PJ: 115, LB: 46, LBD: 62, PL: 54) cm" },
  { value: "L", label: "L (PJ: 120, LB: 48, LBD: 64, PL: 56) cm" },
  { value: "XL", label: "XL (PJ: 125, LB: 50, LBD: 66, PL: 58) cm" },
  { value: "XXL", label: "XXL (PJ: 130, LB: 52, LBD: 68, PL: 60) cm" },
  { value: "XXXL", label: "XXXL (PJ: 135, LB: 54, LBD: 70, PL: 62) cm" },
  { value: "XXXXL", label: "XXXXL (PJ: 140, LB: 56, LBD: 72, PL: 64) cm" },
] as const;

const STEPS = [
  { num: 1, label: "Verifikasi Data" },
  { num: 2, label: "Data Diri" },
  { num: 3, label: "Data Akademik" },
  { num: 4, label: "Konfirmasi" },
] as const;

function formatDateId(dateString: string): string {
  if (!dateString) return "-";
  const parts = dateString.split("-");
  if (parts.length !== 3) return dateString;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function RegistrationForm() {
  const baseId = useId();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1 state
  const [nimInput, setNimInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [verifiedData, setVerifiedData] = useState<VerifiedStudent | null>(null);

  // Step 2 state: Data Diri
  const [gender, setGender] = useState<"Laki-laki" | "Perempuan" | "">("");
  const [togaSize, setTogaSize] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Step 3 state: Data Akademik
  const [gpa, setGpa] = useState("");
  const [graduationDate, setGraduationDate] = useState("");
  const [thesisTitle, setThesisTitle] = useState("");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");

  // General feedback & submit state
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [finalQrUrl, setFinalQrUrl] = useState<string | null>(null);

  async function handleVerify(event?: FormEvent) {
    if (event) event.preventDefault();
    const cleanNim = nimInput.trim().toUpperCase();
    if (!cleanNim) {
      setVerifyResult({ status: "not_found", message: "NIM tidak boleh kosong." });
      setVerifiedData(null);
      return;
    }
    setVerifying(true);
    setStepError(null);
    setVerifyResult(null);
    setVerifiedData(null);

    try {
      const res = await fetch("/api/v1/registration/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nim: cleanNim }),
      });
      const json = (await res.json()) as { data?: VerifyResponse; message?: string };
      if (!res.ok || !json.data) {
        setVerifyResult({
          status: "not_found",
          message: json.message ?? "Gagal memverifikasi NIM. Periksa format NIM Anda.",
        });
        return;
      }
      const result = json.data;
      setVerifyResult(result);
      if (result.status === "success" && result.data) {
        setVerifiedData(result.data);
        setFinalQrUrl(result.data.qr_url);
        const ex = result.data.existing_form;
        if (ex) {
          setGender((ex.gender as "Laki-laki" | "Perempuan") || "");
          setTogaSize(ex.toga_size ?? "");
          setBirthPlace(ex.birth_place ?? "");
          setBirthDate(ex.birth_date ?? "");
          setPhone(ex.phone ?? "");
          setEmail(ex.email ?? "");
          setGpa(ex.gpa ?? "");
          setGraduationDate(ex.graduation_date ?? "");
          setThesisTitle(ex.thesis_title ?? "");
        }
      } else if (result.status === "failed_verification" && result.data) {
        setVerifiedData(result.data);
      }
    } catch {
      setVerifyResult({
        status: "not_found",
        message: "Terjadi kesalahan jaringan. Silakan periksa koneksi internet dan coba lagi.",
      });
    } finally {
      setVerifying(false);
    }
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    setStepError(null);
    const file = event.target.files?.[0];
    if (!file) return;
    const maxBytes = 500 * 1024; // 500 KB sesuai aturan form-wisuda-uninus.html
    if (file.size > maxBytes) {
      setStepError("Ukuran berkas foto melebihi batas maksimal 500 KB.");
      event.target.value = "";
      setPhotoBase64(null);
      setPhotoName("");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setStepError("Format foto harus JPG atau PNG.");
      event.target.value = "";
      setPhotoBase64(null);
      setPhotoName("");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const res = e.target?.result;
      if (typeof res === "string") {
        setPhotoBase64(res);
        setPhotoName(file.name);
      }
    };
    reader.readAsDataURL(file);
  }

  function goToStep2() {
    if (!verifiedData || verifyResult?.status !== "success") return;
    setStepError(null);
    setStep(2);
  }

  function goToStep3() {
    setStepError(null);
    if (!gender) return setStepError('Harap pilih salah satu opsi untuk "Jenis Kelamin".');
    if (!togaSize) return setStepError('Harap pilih "Ukuran Baju Toga".');
    if (!birthPlace.trim()) return setStepError('Harap isi kolom "Tempat Lahir".');
    if (!birthDate) return setStepError('Harap isi kolom "Tanggal Lahir".');
    if (!phone.trim() || !/^[0-9+ -]{8,25}$/.test(phone.trim())) {
      return setStepError('Harap isi "Nomor Handphone/WhatsApp" yang valid.');
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setStepError('Harap isi "Email" yang valid.');
    }
    setStep(3);
  }

  function goToStep4() {
    setStepError(null);
    const gpaNum = Number(gpa);
    if (!gpa || !Number.isFinite(gpaNum) || gpaNum < 0 || gpaNum > 4) {
      return setStepError('Harap isi "IPK" dengan angka valid antara 0.00 sampai 4.00.');
    }
    if (!graduationDate) return setStepError('Harap isi kolom "Tanggal Lulus (Yudisium)".');
    if (!thesisTitle.trim()) {
      return setStepError('Harap isi kolom "Judul Tugas Akhir/Skripsi/Tesis/Disertasi".');
    }
    const alreadyHasPhoto = verifiedData?.registration_status === "terdaftar";
    if (!photoBase64 && !alreadyHasPhoto) {
      return setStepError('Harap unggah "Foto Formal" (JPG/PNG maks. 500 KB).');
    }
    setStep(4);
  }

  async function handleSubmit() {
    if (!verifiedData) return;
    setSubmitting(true);
    setStepError(null);
    try {
      const csrfRes = await fetch("/sanctum/csrf-cookie", {
        credentials: "same-origin",
        cache: "no-store",
      });
      let xsrf = "";
      if (csrfRes.ok) {
        for (const part of document.cookie.split("; ")) {
          if (part.startsWith("XSRF-TOKEN=")) {
            xsrf = decodeURIComponent(part.slice("XSRF-TOKEN=".length));
          }
        }
      }

      const res = await fetch("/api/v1/registration/submit", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
        body: JSON.stringify({
          nim: verifiedData.nim,
          gender,
          toga_size: togaSize,
          birth_place: birthPlace.trim(),
          birth_date: birthDate,
          phone: phone.trim(),
          email: email.trim(),
          gpa: Number(gpa),
          graduation_date: graduationDate,
          thesis_title: thesisTitle.trim(),
          ...(photoBase64 ? { photo_base64: photoBase64 } : {}),
        }),
      });
      const json = (await res.json()) as {
        data?: { qr_url: string };
        message?: string;
      };
      if (!res.ok) {
        setStepError(json.message ?? "Gagal mengirimkan data pendaftaran.");
        return;
      }
      if (json.data?.qr_url) {
        setFinalQrUrl(json.data.qr_url);
      }
      setStep(5);
    } catch {
      setStepError("Gagal terhubung ke server. Periksa koneksi internet Anda.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setStep(1);
    setNimInput("");
    setVerifyResult(null);
    setVerifiedData(null);
    setGender("");
    setTogaSize("");
    setBirthPlace("");
    setBirthDate("");
    setPhone("");
    setEmail("");
    setGpa("");
    setGraduationDate("");
    setThesisTitle("");
    setPhotoBase64(null);
    setPhotoName("");
    setStepError(null);
  }

  function printProofPdf() {
    window.print();
  }

  const inputCls =
    "mt-1 block min-h-11 w-full rounded-lg border-2 border-forest-900/25 bg-white px-3.5 py-2 text-[15px] text-forest-900 shadow-xs transition-colors focus:border-brand-green focus:outline-none";
  const disabledCls =
    "mt-1 block min-h-11 w-full cursor-not-allowed rounded-lg border-2 border-forest-900/15 bg-mist-bg px-3.5 py-2 text-[15px] font-semibold text-forest-900/80";

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Kontainer Utama Formulir (Tidak ikut tercetak saat mode cetak bukti) */}
      <div className="rounded-2xl border border-forest-900/10 bg-white p-6 shadow-xl transition-all sm:p-10 print:hidden">
        {/* Header */}
        <div className="mb-8 text-center">
          <Image
            src="/brand/logo-uninus.png"
            alt="Logo UNINUS"
            width={64}
            height={88}
            className="mx-auto mb-3 h-auto w-14 sm:w-16"
            priority
          />
          <h1 className="text-2xl font-extrabold tracking-tight text-forest-900 sm:text-3xl">
            Formulir Pendaftaran Wisuda ke-70
          </h1>
          <p className="mt-1 text-[15px] font-medium text-ink-muted">
            Universitas Islam Nusantara — T.A. 2025/2026
          </p>
        </div>

        {/* Progress Bar Indikator 4 Langkah */}
        {step <= 4 && (
          <div className="mb-8 w-full" aria-label="Tahapan pendaftaran">
            <div className="flex items-center justify-between">
              {STEPS.map((item, idx) => {
                const active = item.num <= step;
                return (
                  <div key={item.num} className="contents">
                    <div className="flex-1 text-center">
                      <div
                        className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-base font-extrabold transition-colors sm:h-10 sm:w-10 ${
                          active ? "bg-brand-green-deep text-white" : "bg-mist text-ink-muted"
                        }`}
                      >
                        {item.num === 4 ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          item.num
                        )}
                      </div>
                      <p
                        className={`mt-2 text-xs sm:text-sm ${
                          active
                            ? "font-extrabold text-brand-green-deep"
                            : "font-medium text-ink-muted"
                        }`}
                      >
                        {item.label}
                      </p>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className="flex-1 px-1">
                        <div
                          className={`h-1 w-full rounded ${
                            idx + 2 <= step ? "bg-brand-green-deep" : "bg-mist"
                          }`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pesan Galat Langkah */}
        {stepError && (
          <div
            role="alert"
            className="mb-6 rounded-lg border-l-4 border-[#b3261e] bg-[#fdecea] p-4 text-[14px] font-semibold text-[#7a1712]"
          >
            {stepError}
          </div>
        )}

        {/* LANGKAH 1: Verifikasi NIM (Tanpa Gelombang) */}
        {step === 1 && (
          <div>
            <h2 className="mb-4 text-lg font-extrabold text-forest-900 sm:text-xl">
              Langkah 1: Verifikasi Nomor Induk Mahasiswa (NIM)
            </h2>
            <div className="grid grid-cols-1 gap-5">
              <div>
                <label
                  htmlFor={`${baseId}-nim`}
                  className="block text-sm font-bold text-forest-900"
                >
                  NIM
                </label>
                <form onSubmit={handleVerify} className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    id={`${baseId}-nim`}
                    value={nimInput}
                    onChange={(e) => setNimInput(e.target.value)}
                    maxLength={30}
                    placeholder="Masukkan NIM Anda (contoh: 20260001)"
                    className="min-h-11 grow rounded-lg border-2 border-forest-900/30 bg-white px-3.5 py-2 text-[15px] font-semibold text-forest-900 focus:border-brand-green focus:outline-none"
                    required
                  />
                  <button
                    type="submit"
                    disabled={verifying}
                    className="inline-flex min-h-11 w-24 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-brand-green-deep px-4 text-[15px] font-bold text-white transition-colors hover:bg-forest-800 disabled:cursor-wait disabled:opacity-60"
                  >
                    {verifying ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      "Cek"
                    )}
                  </button>
                </form>

                {/* Status Hasil Verifikasi */}
                <div aria-live="polite" className="mt-3">
                  {verifying && (
                    <p className="text-sm font-semibold text-brand-green-deep">
                      Memverifikasi kelayakan pembayaran & yudisium...
                    </p>
                  )}
                  {verifyResult?.status === "success" && (
                    <div className="rounded-lg border-l-4 border-[#0b7a3e] bg-[#e7f5ec] p-4 text-[#0a4d28]">
                      <h3 className="font-extrabold">Verifikasi Berhasil!</h3>
                      <p className="mt-1 text-sm">{verifyResult.message}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[#0a4d28]">
                          ✓ Keuangan: Lunas
                        </span>
                        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[#0a4d28]">
                          ✓ Akademik: Telah Yudisium
                        </span>
                      </div>
                    </div>
                  )}
                  {verifyResult?.status === "failed_verification" && (
                    <div className="rounded-lg border-l-4 border-[#b3261e] bg-[#fdecea] p-4 text-[#7a1712]">
                      <h3 className="font-extrabold">TIDAK BISA DAFTAR WISUDA</h3>
                      <p className="mt-1 text-sm">
                        Mohon maaf, Anda belum dapat melanjutkan pendaftaran karena:
                      </p>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-sm font-semibold">
                        {verifyResult.reasons?.map((reason, i) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs">
                        Silakan hubungi bagian Administrasi Keuangan atau Akademik/BAAK untuk
                        pembaruan status.
                      </p>
                    </div>
                  )}
                  {verifyResult?.status === "not_found" && (
                    <div className="rounded-lg border-l-4 border-[#b28704] bg-[#fff3c4] p-4 text-[#6b5200]">
                      <h3 className="font-extrabold">Informasi</h3>
                      <p className="mt-1 text-sm">{verifyResult.message}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor={`${baseId}-nama`}
                  className="block text-sm font-bold text-forest-900"
                >
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  id={`${baseId}-nama`}
                  value={verifiedData?.name ?? ""}
                  readOnly
                  placeholder="Otomatis terisi setelah verifikasi NIM"
                  className={disabledCls}
                />
              </div>

              <div>
                <label
                  htmlFor={`${baseId}-prodi`}
                  className="block text-sm font-bold text-forest-900"
                >
                  Program Studi
                </label>
                <input
                  type="text"
                  id={`${baseId}-prodi`}
                  value={verifiedData?.study_program ?? ""}
                  readOnly
                  placeholder="Otomatis terisi setelah verifikasi NIM"
                  className={disabledCls}
                />
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between gap-4">
              <Link
                href="/"
                className="text-sm font-bold text-forest-900 underline underline-offset-2 hover:text-brand-green-deep"
              >
                ← Kembali ke Beranda
              </Link>
              <button
                type="button"
                onClick={goToStep2}
                disabled={verifyResult?.status !== "success"}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-brand-green-deep px-6 text-[15px] font-bold text-white transition-colors hover:bg-forest-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                Selanjutnya →
              </button>
            </div>
          </div>
        )}

        {/* LANGKAH 2: Lengkapi Data Diri */}
        {step === 2 && (
          <div>
            <h2 className="mb-4 text-lg font-extrabold text-forest-900 sm:text-xl">
              Langkah 2: Lengkapi Data Diri
            </h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <span className="block text-sm font-bold text-forest-900">Jenis Kelamin</span>
                <div className="mt-2 flex items-center gap-6">
                  {(["Laki-laki", "Perempuan"] as const).map((g) => (
                    <label key={g} className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="jenis_kelamin"
                        value={g}
                        checked={gender === g}
                        onChange={() => setGender(g)}
                        className="h-4 w-4 accent-brand-green-deep"
                        required
                      />
                      <span className="text-[15px] font-medium text-forest-900">{g}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor={`${baseId}-toga`}
                  className="block text-sm font-bold text-forest-900"
                >
                  Ukuran Baju Toga
                </label>
                <select
                  id={`${baseId}-toga`}
                  value={togaSize}
                  onChange={(e) => setTogaSize(e.target.value)}
                  className={inputCls}
                  required
                >
                  <option value="" disabled>
                    Pilih ukuran...
                  </option>
                  {TOGA_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-ink-muted">
                  PJ: Panjang Jubah, LB: Lebar Bahu, LBD: Lebar Badan, PL: Panjang Lengan.
                </p>
              </div>

              <div>
                <label
                  htmlFor={`${baseId}-tempat-lahir`}
                  className="block text-sm font-bold text-forest-900"
                >
                  Tempat Lahir
                </label>
                <input
                  type="text"
                  id={`${baseId}-tempat-lahir`}
                  value={birthPlace}
                  onChange={(e) => setBirthPlace(e.target.value)}
                  maxLength={120}
                  placeholder="Contoh: Bandung"
                  className={inputCls}
                  required
                />
                <p className="mt-1 text-xs text-ink-muted">
                  Tidak perlu memasukkan tanggal lahir, cukup nama kota/kabupaten tempat lahir.
                </p>
              </div>

              <div>
                <label
                  htmlFor={`${baseId}-tanggal-lahir`}
                  className="block text-sm font-bold text-forest-900"
                >
                  Tanggal Lahir
                </label>
                <input
                  type="date"
                  id={`${baseId}-tanggal-lahir`}
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label htmlFor={`${baseId}-hp`} className="block text-sm font-bold text-forest-900">
                  Nomor Handphone/WhatsApp
                </label>
                <input
                  type="tel"
                  id={`${baseId}-hp`}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={30}
                  placeholder="08xxxxxxxxxx"
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor={`${baseId}-email`}
                  className="block text-sm font-bold text-forest-900"
                >
                  Email
                </label>
                <input
                  type="email"
                  id={`${baseId}-email`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={160}
                  placeholder="anda@email.com"
                  className={inputCls}
                  required
                />
              </div>
            </div>

            <div className="mt-8 flex justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  setStepError(null);
                  setStep(1);
                }}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-gray-600 px-6 text-[15px] font-bold text-white transition-colors hover:bg-gray-700"
              >
                ← Kembali
              </button>
              <button
                type="button"
                onClick={goToStep3}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-brand-green-deep px-6 text-[15px] font-bold text-white transition-colors hover:bg-forest-800"
              >
                Selanjutnya →
              </button>
            </div>
          </div>
        )}

        {/* LANGKAH 3: Data Akademik */}
        {step === 3 && (
          <div>
            <h2 className="mb-4 text-lg font-extrabold text-forest-900 sm:text-xl">
              Langkah 3: Data Akademik
            </h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor={`${baseId}-ipk`}
                  className="block text-sm font-bold text-forest-900"
                >
                  IPK
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="4"
                  id={`${baseId}-ipk`}
                  value={gpa}
                  onChange={(e) => setGpa(e.target.value)}
                  placeholder="Contoh: 3.50"
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor={`${baseId}-tgl-lulus`}
                  className="block text-sm font-bold text-forest-900"
                >
                  Tanggal Lulus (Yudisium)
                </label>
                <input
                  type="date"
                  id={`${baseId}-tgl-lulus`}
                  value={graduationDate}
                  onChange={(e) => setGraduationDate(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor={`${baseId}-skripsi`}
                  className="block text-sm font-bold text-forest-900"
                >
                  Judul Tugas Akhir / Skripsi / Tesis / Disertasi
                </label>
                <textarea
                  id={`${baseId}-skripsi`}
                  rows={3}
                  maxLength={500}
                  value={thesisTitle}
                  onChange={(e) => setThesisTitle(e.target.value)}
                  placeholder="Masukkan judul lengkap tugas akhir Anda..."
                  className={inputCls}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor={`${baseId}-foto`}
                  className="block text-sm font-bold text-forest-900"
                >
                  Upload Foto Formal
                </label>
                <div className="mt-2 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-32 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-forest-900/20 bg-mist-bg text-center text-xs font-semibold text-ink-muted">
                    {photoBase64 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoBase64}
                        alt="Pratinjau foto formal"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>Foto Anda</span>
                    )}
                  </div>
                  <div className="w-full">
                    <input
                      type="file"
                      id={`${baseId}-foto`}
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoChange}
                      className="block w-full text-sm text-ink-muted file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-[#e7f5ec] file:px-4 file:py-2 file:text-sm file:font-bold file:text-brand-green-deep hover:file:bg-[#d3ecdc]"
                    />
                    <p className="mt-2 text-xs text-ink-muted">
                      JPG atau PNG, maks. 500 KB. Latar belakang hitam putih / formal.
                      {verifiedData?.registration_status === "terdaftar" && !photoBase64 && (
                        <strong className="ml-1 text-brand-green-deep">
                          (Kosongkan bila tidak ingin mengganti foto sebelumnya)
                        </strong>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  setStepError(null);
                  setStep(2);
                }}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-gray-600 px-6 text-[15px] font-bold text-white transition-colors hover:bg-gray-700"
              >
                ← Kembali
              </button>
              <button
                type="button"
                onClick={goToStep4}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-brand-green-deep px-6 text-[15px] font-bold text-white transition-colors hover:bg-forest-800"
              >
                Konfirmasi Data →
              </button>
            </div>
          </div>
        )}

        {/* LANGKAH 4: Konfirmasi Data Pendaftaran */}
        {step === 4 && verifiedData && (
          <div>
            <h2 className="mb-2 text-lg font-extrabold text-forest-900 sm:text-xl">
              Langkah 4: Konfirmasi Data Pendaftaran
            </h2>
            <p className="mb-6 text-sm text-ink-muted">
              Mohon periksa kembali data yang telah Anda masukkan. Pastikan semua data sudah benar
              sebelum mengirimkan formulir.
            </p>

            <div className="divide-y divide-forest-900/10 rounded-xl bg-mist-bg p-5 text-sm sm:p-6">
              {[
                ["NIM", verifiedData.nim],
                ["Nama Lengkap", verifiedData.name],
                ["Program Studi", verifiedData.study_program],
                ["Jenis Kelamin", gender],
                ["Tempat, Tanggal Lahir", `${birthPlace}, ${formatDateId(birthDate)}`],
                ["No. HP/WhatsApp", phone],
                ["Email", email],
                ["Ukuran Baju Toga", togaSize],
                ["IPK", Number(gpa).toFixed(2)],
                ["Tanggal Lulus (Yudisium)", formatDateId(graduationDate)],
                ["Judul Tugas Akhir", thesisTitle],
                ["Berkas Foto", photoName || "Foto tersimpan"],
              ].map(([label, val]) => (
                <div
                  key={label}
                  className="flex flex-col justify-between gap-1 py-2.5 sm:flex-row sm:items-start sm:gap-4"
                >
                  <span className="shrink-0 font-semibold text-ink-muted">{label}:</span>
                  <span className="font-bold text-forest-900 sm:text-right">{val}</span>
                </div>
              ))}
              {photoBase64 && (
                <div className="flex items-start justify-between py-3">
                  <span className="font-semibold text-ink-muted">Pratinjau Foto:</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoBase64}
                    alt="Pratinjau foto"
                    className="h-28 w-24 rounded-md border border-forest-900/20 object-cover"
                  />
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setStepError(null);
                  setStep(3);
                }}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-gray-600 px-6 text-[15px] font-bold text-white transition-colors hover:bg-gray-700"
              >
                ← Edit Kembali
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-brand-green-deep px-7 text-[15px] font-bold text-white transition-colors hover:bg-forest-800 disabled:cursor-wait disabled:opacity-60"
              >
                {submitting ? "Mengirim Pendaftaran..." : "Kirim Pendaftaran"}
              </button>
            </div>
          </div>
        )}

        {/* LANGKAH 5: Sukses & Unduh Bukti / Kartu QR */}
        {step === 5 && verifiedData && (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#e7f5ec] text-brand-green-deep">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-2xl font-extrabold text-forest-900">Pendaftaran Berhasil!</h2>
            <p className="mt-2 text-[15px] text-ink-muted">
              Terima kasih telah melakukan pendaftaran Wisuda ke-70 UNINUS. Data Anda telah
              tersimpan di sistem dan langsung terhubung dengan dashboard panitia.
            </p>

            {finalQrUrl && (
              <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3 rounded-xl border-2 border-forest-900 bg-mist-bg p-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={finalQrUrl}
                  alt={`Kode QR kehadiran untuk NIM ${verifiedData.nim}`}
                  width={200}
                  height={200}
                  className="h-48 w-48 rounded bg-white p-2"
                />
                <p className="text-xs font-semibold text-ink-muted">
                  Kartu QR Kehadiran Gladi Resik & Hari-H ({verifiedData.nim})
                </p>
                <a
                  href={finalQrUrl}
                  download={`QR-WISUDA-70-${verifiedData.nim}.png`}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-gold px-5 text-sm font-extrabold text-forest-900 no-underline hover:bg-gold-soft"
                >
                  Unduh Kartu QR (PNG)
                </a>
              </div>
            )}

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={printProofPdf}
                className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-brand-green-deep px-7 text-[15px] font-bold text-white shadow-md transition-colors hover:bg-forest-800 sm:w-auto"
              >
                Cetak / Unduh Bukti Pendaftaran (PDF)
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-lg border-2 border-forest-900/25 bg-white px-7 text-[15px] font-bold text-forest-900 transition-colors hover:bg-mist-bg sm:w-auto"
              >
                Kembali ke Awal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lembar Bukti Pendaftaran Khusus Cetak / Simpan PDF (window.print) */}
      {verifiedData && (
        <div className="hidden bg-white p-8 text-black print:block">
          <div className="border-b-2 border-black pb-4 text-center">
            <h1 className="text-xl font-bold uppercase">Bukti Pendaftaran Wisuda ke-70</h1>
            <p className="text-sm">Universitas Islam Nusantara — Tahun Akademik 2025/2026</p>
          </div>
          <div className="mt-6 flex items-start justify-between gap-6">
            <table className="w-full text-left text-sm">
              <tbody>
                {[
                  ["NIM", verifiedData.nim],
                  ["Nama Lengkap", verifiedData.name],
                  ["Program Studi", verifiedData.study_program],
                  ["Jenis Kelamin", gender],
                  ["Tempat, Tgl Lahir", `${birthPlace}, ${formatDateId(birthDate)}`],
                  ["No. HP/WhatsApp", phone],
                  ["Email", email],
                  ["Ukuran Baju Toga", togaSize],
                  ["IPK", gpa ? Number(gpa).toFixed(2) : "-"],
                  ["Tanggal Lulus", formatDateId(graduationDate)],
                  ["Judul Tugas Akhir", thesisTitle],
                ].map(([label, val]) => (
                  <tr key={label} className="border-b border-gray-200">
                    <th className="w-44 py-2 font-bold">{label}</th>
                    <td className="py-2">: {val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex shrink-0 flex-col items-center gap-3">
              {photoBase64 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoBase64}
                  alt="Foto Wisudawan"
                  className="h-36 w-28 border border-black object-cover"
                />
              )}
              {finalQrUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={finalQrUrl}
                  alt="QR Kehadiran"
                  className="h-28 w-28 border border-black"
                />
              )}
            </div>
          </div>
          <div className="mt-8 border-t border-black pt-4 text-xs italic">
            <p>Dokumen ini merupakan bukti sah pendaftaran Wisuda ke-70 UNINUS.</p>
            <p>Harap dibawa saat pengambilan toga dan perlengkapan wisuda.</p>
          </div>
        </div>
      )}
    </div>
  );
}
