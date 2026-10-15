"use client";

import { useState, type FormEvent } from "react";

import {
  Card,
  Field,
  Notice,
  PageTitle,
  Pager,
  Table,
  Td,
  btnDanger,
  inputClass,
  useLoad,
  when,
} from "@/components/admin/ui";
import { api } from "@/lib/api";

interface Entry {
  id: number;
  action: string;
  entity: string | null;
  entity_id: number | null;
  detail: Record<string, unknown>;
  created_at: string;
  user_name: string | null;
}

const CONFIRMATION = "ANONIMKAN WISUDA 70";

function Retention() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!window.confirm("Tindakan ini PERMANEN dan tidak dapat dibatalkan. Lanjutkan?")) return;
    setBusy(true);
    const res = await api<{ students: number; unregistered_entries: number }>(
      "POST",
      "/api/v1/admin/retention/anonymize",
      { confirm: text },
    );
    setBusy(false);
    setText("");
    setResult(
      res.ok && res.data
        ? {
            kind: "success",
            text: `${res.data.students} wisudawan dan ${res.data.unregistered_entries} entri dianonimkan.`,
          }
        : { kind: "error", text: res.message ?? "Gagal." },
    );
  };

  return (
    <Card title="Retensi data pribadi (anonimisasi)" className="border-[#b3261e]/40">
      <p className="mb-3 text-[15px]">
        Menghapus <strong>nama, NIM, angkatan, dan tanggal lulus</strong> seluruh wisudawan Wisuda
        ke-70 secara permanen, serta mematikan semua QR. Catatan kehadiran (agregat) tetap ada.
        Jalankan <strong>hanya setelah BAAK menetapkan periode retensi secara tertulis</strong> dan
        rekap sudah diunduh.
      </p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <Field label={`Ketik “${CONFIRMATION}” untuk mengonfirmasi`}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={`${inputClass} min-w-[300px]`}
            autoComplete="off"
          />
        </Field>
        <button type="submit" disabled={busy || text !== CONFIRMATION} className={btnDanger}>
          Anonimkan sekarang
        </button>
      </form>
      {result && (
        <div className="mt-4">
          <Notice kind={result.kind}>{result.text}</Notice>
        </div>
      )}
    </Card>
  );
}

export function AuditRetention() {
  const [page, setPage] = useState(1);
  const log = useLoad<Entry[]>(`/api/v1/admin/audit-log?page=${page}&per_page=50`);

  return (
    <>
      <PageTitle title="Audit & Retensi" />
      <div className="grid gap-6">
        <Card title="Log audit">
          <p className="mb-4 text-[14px] text-ink-muted">
            Mencatat login, perubahan akun, impor, perubahan data wisudawan, pengaktifan sesi,
            ekspor, dan anonimisasi. Alamat IP disimpan hanya sebagai sidik jari ber-kunci.
          </p>
          {log.error && <Notice kind="error">{log.error}</Notice>}
          {log.loading && <p>Memuat…</p>}
          {log.data && (
            <Table head={["Waktu", "Pengguna", "Tindakan", "Objek", "Rincian"]}>
              {log.data.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap">{when(e.created_at)}</Td>
                  <Td>{e.user_name ?? "—"}</Td>
                  <Td className="font-mono text-[13px]">{e.action}</Td>
                  <Td>{e.entity ? `${e.entity}${e.entity_id ? ` #${e.entity_id}` : ""}` : "—"}</Td>
                  <Td className="font-mono text-[12px] text-ink-muted">
                    {Object.keys(e.detail).length ? JSON.stringify(e.detail) : ""}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
          <Pager meta={log.meta} onPage={setPage} />
        </Card>
        <Retention />
      </div>
    </>
  );
}
