"use client";

import { useState, type ChangeEvent } from "react";

import {
  Badge,
  Card,
  Notice,
  PageTitle,
  Table,
  Td,
  btnGhost,
  btnGold,
  btnPrimary,
  useLoad,
  when,
} from "@/components/admin/ui";
import { uploadCsv } from "@/lib/api";

interface Issue {
  row: number;
  column: string;
  message: string;
}
interface Report {
  dry_run: boolean;
  total_rows: number;
  valid_rows: number;
  error_count: number;
  errors: Issue[];
  warnings: Issue[];
  ignored_columns: string[];
  would_insert?: number;
  would_update?: number;
  inserted?: number;
  updated?: number;
  batch_id?: number;
}
interface Batch {
  id: number;
  original_filename: string;
  status: string;
  total_rows: number | null;
  inserted_count: number | null;
  updated_count: number | null;
  failed_count: number | null;
  created_at: string;
  imported_by: string;
}

const MAX_BYTES = 5_000_000;

function IssueList({
  title,
  items,
  tone,
}: {
  title: string;
  items: Issue[];
  tone: "error" | "info";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 font-extrabold">
        {title} ({items.length})
      </h3>
      <Table head={["Baris", "Kolom", "Masalah"]}>
        {items.slice(0, 100).map((issue, index) => (
          <tr key={index} className={tone === "error" ? "bg-[#fdecea]/60" : ""}>
            <Td className="tabular-nums">{issue.row}</Td>
            <Td>{issue.column}</Td>
            <Td>{issue.message}</Td>
          </tr>
        ))}
      </Table>
      {items.length > 100 && (
        <p className="mt-2 text-[14px] text-ink-muted">
          Menampilkan 100 pertama dari {items.length}.
        </p>
      )}
    </div>
  );
}

export function Importer() {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<Report | null>(null);
  const [result, setResult] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const batches = useLoad<Batch[]>("/api/v1/admin/import-batches");

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    setPreview(null);
    setResult(null);
    setError(null);
    if (!picked) return setFile(null);
    if (!picked.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      return setError("Gunakan berkas .csv (CSV UTF-8). Dari Excel: Simpan Sebagai → CSV UTF-8.");
    }
    if (picked.size > MAX_BYTES) {
      setFile(null);
      return setError("Berkas melebihi 5 MB.");
    }
    setFile({ name: picked.name, text: await picked.text() });
  };

  const run = async (dryRun: boolean) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const res = await uploadCsv<Report>(
      `/api/v1/admin/students/import${dryRun ? "?dry_run=1" : ""}`,
      file.text,
      file.name,
    );
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.message ?? "Gagal memproses berkas.");
    if (dryRun) {
      setPreview(res.data);
    } else {
      setResult(res.data);
      setPreview(null);
      batches.reload();
    }
  };

  const data = result ?? preview;
  return (
    <>
      <PageTitle title="Impor Data Wisudawan" />
      <div className="grid gap-6">
        <Notice kind="info">
          Format <strong>CSV UTF-8</strong>. Kolom wajib: <code>NIM</code>, <code>NAMA</code>,{" "}
          <code>PROGRAM STUDI</code>; opsional <code>ANGKATAN</code> dan <code>TANGGAL LULUS</code>.
          Impor ulang <strong>aman</strong>: data diperbarui per NIM, tidak ada duplikat, dan{" "}
          <strong>QR yang sudah dibagikan tidak berubah</strong>.{" "}
          <a href="/template-impor-wisudawan.csv" download className="underline">
            Unduh templat
          </a>
          .
        </Notice>

        <Card title="1. Pilih berkas, 2. Periksa, 3. Impor">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-h-11 cursor-pointer items-center rounded border-2 border-dashed border-forest-900/40 px-4 text-[14px] font-bold hover:bg-forest-900/5">
              <input type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" />
              {file ? file.name : "Pilih berkas CSV…"}
            </label>
            <button
              type="button"
              disabled={!file || busy}
              onClick={() => run(true)}
              className={btnPrimary}
            >
              {busy && !preview ? "Memeriksa…" : "Periksa (pratinjau)"}
            </button>
            <button
              type="button"
              disabled={!file || busy || !preview || preview.valid_rows === 0}
              onClick={() => run(false)}
              className={btnGold}
            >
              Impor sekarang
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                setFile(null);
                setPreview(null);
                setResult(null);
                setError(null);
              }}
            >
              Bersihkan
            </button>
          </div>
          {error && (
            <div className="mt-4">
              <Notice kind="error">{error}</Notice>
            </div>
          )}
        </Card>

        {data && (
          <Card title={result ? "Hasil impor" : "Hasil pemeriksaan (belum ada yang disimpan)"}>
            <div className="mb-5 flex flex-wrap gap-2">
              <Badge tone="gray">{data.total_rows} baris</Badge>
              <Badge tone="green">{data.valid_rows} valid</Badge>
              <Badge tone={data.error_count ? "red" : "gray"}>{data.error_count} bermasalah</Badge>
              {result ? (
                <>
                  <Badge tone="green">{result.inserted} baru</Badge>
                  <Badge tone="gold">{result.updated} diperbarui</Badge>
                </>
              ) : (
                <>
                  <Badge tone="green">{data.would_insert} akan ditambah</Badge>
                  <Badge tone="gold">{data.would_update} akan diperbarui</Badge>
                </>
              )}
            </div>
            {data.ignored_columns.length > 0 && (
              <p className="mb-4 text-[14px] text-ink-muted">
                Kolom diabaikan: {data.ignored_columns.join(", ")}
              </p>
            )}
            {!result && data.error_count > 0 && (
              <div className="mb-4">
                <Notice kind="error">
                  Baris bermasalah <strong>tidak akan diimpor</strong>. Perbaiki di berkas sumber
                  lalu periksa lagi, atau impor baris yang valid saja.
                </Notice>
              </div>
            )}
            <div className="grid gap-6">
              <IssueList title="Masalah" items={data.errors} tone="error" />
              <IssueList title="Peringatan" items={data.warnings} tone="info" />
            </div>
          </Card>
        )}

        <Card title="Riwayat impor">
          {batches.loading && <p>Memuat…</p>}
          {batches.data && (
            <Table head={["Waktu", "Berkas", "Oleh", "Baris", "Baru", "Diperbarui", "Gagal"]}>
              {batches.data.map((b) => (
                <tr key={b.id}>
                  <Td className="whitespace-nowrap">{when(b.created_at)}</Td>
                  <Td>{decodeURIComponent(b.original_filename)}</Td>
                  <Td>{b.imported_by}</Td>
                  <Td className="tabular-nums">{b.total_rows ?? "—"}</Td>
                  <Td className="tabular-nums">{b.inserted_count ?? "—"}</Td>
                  <Td className="tabular-nums">{b.updated_count ?? "—"}</Td>
                  <Td className="tabular-nums">{b.failed_count ?? "—"}</Td>
                </tr>
              ))}
              {batches.data.length === 0 && (
                <tr>
                  <Td className="text-ink-muted">Belum ada impor.</Td>
                  <Td />
                  <Td />
                  <Td />
                  <Td />
                  <Td />
                  <Td />
                </tr>
              )}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
