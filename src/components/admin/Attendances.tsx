"use client";

import { useState } from "react";

import { SessionPicker, useSessions } from "@/components/admin/SessionPicker";
import {
  Badge,
  Card,
  Notice,
  PageTitle,
  Pager,
  Table,
  Td,
  btnGhost,
  btnGold,
  useLoad,
  when,
} from "@/components/admin/ui";
import { api } from "@/lib/api";

interface Row {
  id: number;
  nim: string;
  name: string;
  study_program: string;
  scanned_at: string;
  method: "qr" | "manual";
  outside_window: boolean;
  device_label: string | null;
  recorded_by: string;
}
interface Unregistered {
  id: number;
  typed_nim: string;
  typed_name: string | null;
  created_at: string;
  reviewed_at: string | null;
  entered_by: string;
}

export function Attendances() {
  const { sessions, sessionId, setSessionId } = useSessions();
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const rows = useLoad<Row[]>(
    sessionId ? `/api/v1/admin/attendances?session_id=${sessionId}&page=${page}&per_page=50` : null,
  );
  const unregistered = useLoad<Unregistered[]>(
    sessionId ? `/api/v1/admin/unregistered?session_id=${sessionId}` : null,
  );

  const review = async (id: number) => {
    const res = await api("POST", `/api/v1/admin/unregistered/${id}/review`);
    setNotice(res.ok ? "Ditandai sudah ditinjau." : (res.message ?? "Gagal."));
    unregistered.reload();
  };

  return (
    <>
      <PageTitle title="Kehadiran">
        <SessionPicker
          sessions={sessions}
          value={sessionId}
          onChange={(id) => {
            setSessionId(id);
            setPage(1);
          }}
        />
      </PageTitle>
      <div className="grid gap-6">
        {notice && <Notice kind="success">{notice}</Notice>}

        <Card title="Rekap">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {sessionId ? (
              <a
                href={`/api/v1/admin/attendances/export?session_id=${sessionId}`}
                download
                className={btnGold}
              >
                Unduh rekap CSV (semua wisudawan, hadir dan belum)
              </a>
            ) : null}
            <button type="button" className={btnGhost} onClick={() => rows.reload()}>
              Segarkan
            </button>
          </div>
          {rows.error && <Notice kind="error">{rows.error}</Notice>}
          {rows.loading && <p>Memuat…</p>}
          {rows.data && (
            <Table
              head={["Waktu", "NIM", "Nama", "Program studi", "Metode", "Dicatat oleh", "Meja"]}
            >
              {rows.data.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap">{when(r.scanned_at)}</Td>
                  <Td className="font-mono">{r.nim}</Td>
                  <Td>{r.name}</Td>
                  <Td>{r.study_program}</Td>
                  <Td>
                    {r.method === "qr" ? (
                      <Badge tone="green">QR</Badge>
                    ) : (
                      <Badge tone="gold">Manual</Badge>
                    )}{" "}
                    {r.outside_window && <Badge tone="red">di luar jam</Badge>}
                  </Td>
                  <Td>{r.recorded_by}</Td>
                  <Td>{r.device_label ?? "—"}</Td>
                </tr>
              ))}
              {rows.data.length === 0 && (
                <tr>
                  <Td className="text-ink-muted">Belum ada kehadiran pada sesi ini.</Td>
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
          <Pager meta={rows.meta} onPage={setPage} />
        </Card>

        <Card title="Entri “tidak terdaftar” (tidak dihitung hadir)">
          <p className="mb-4 text-[14px] text-ink-muted">
            NIM yang diketik petugas tetapi tidak ada di daftar. Tinjau, lalu perbaiki data
            wisudawan bila memang sah.
          </p>
          {unregistered.data && (
            <Table head={["Waktu", "NIM diketik", "Nama diketik", "Petugas", "Status"]}>
              {unregistered.data.map((u) => (
                <tr key={u.id}>
                  <Td className="whitespace-nowrap">{when(u.created_at)}</Td>
                  <Td className="font-mono">{u.typed_nim}</Td>
                  <Td>{u.typed_name ?? "—"}</Td>
                  <Td>{u.entered_by}</Td>
                  <Td>
                    {u.reviewed_at ? (
                      <Badge tone="gray">Ditinjau</Badge>
                    ) : (
                      <button type="button" className={btnGhost} onClick={() => review(u.id)}>
                        Tandai ditinjau
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
              {unregistered.data.length === 0 && (
                <tr>
                  <Td className="text-ink-muted">Tidak ada.</Td>
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
