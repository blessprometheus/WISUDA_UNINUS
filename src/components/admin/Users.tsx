"use client";

import { useState, type FormEvent } from "react";

import {
  Badge,
  Card,
  Field,
  Notice,
  PageTitle,
  Table,
  Td,
  btnGhost,
  btnPrimary,
  inputClass,
  useLoad,
  when,
} from "@/components/admin/ui";
import { api, type Role } from "@/lib/api";

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  totp_enabled: boolean;
  created_at: string;
}

const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Superadmin",
  petugas: "Petugas scan",
  koordinator: "Koordinator divisi",
  ketua: "Ketua",
};

/** Kata sandi sementara: tampil sekali, dengan tombol salin. Tidak disimpan di mana pun di klien. */
function SecretBox({
  email,
  password,
  onClose,
}: {
  email: string;
  password: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded border-2 border-[#8a6a00] bg-[#fff8dd] p-4">
      <p className="font-extrabold">Kata sandi sementara untuk {email}</p>
      <p className="my-2 select-all break-all rounded bg-white px-3 py-2 font-mono text-lg">
        {password}
      </p>
      <p className="mb-3 text-[14px]">
        <strong>Tampil sekali ini saja.</strong> Berikan lewat jalur yang aman (bukan grup umum).
        Pengguna sebaiknya segera menggantinya.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          className={btnPrimary}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(password);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Tersalin ✓" : "Salin"}
        </button>
        <button type="button" className={btnGhost} onClick={onClose}>
          Sudah saya catat, tutup
        </button>
      </div>
    </div>
  );
}

export function Users() {
  const list = useLoad<UserRow[]>("/api/v1/admin/users");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("petugas");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api<{ email: string; temporary_password: string }>(
      "POST",
      "/api/v1/admin/users",
      { name, email, role },
    );
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.message ?? "Gagal membuat akun.");
    setSecret({ email: res.data.email, password: res.data.temporary_password });
    setName("");
    setEmail("");
    list.reload();
  };

  const act = async (user: UserRow, action: string, confirmText: string, success: string) => {
    if (!window.confirm(confirmText)) return;
    const res = await api<{ temporary_password?: string }>(
      "POST",
      `/api/v1/admin/users/${user.id}/${action}`,
    );
    if (!res.ok) setNotice(res.message ?? "Gagal.");
    else if (res.data?.temporary_password)
      setSecret({ email: user.email, password: res.data.temporary_password });
    else setNotice(success);
    list.reload();
  };

  return (
    <>
      <PageTitle title="Pengguna" />
      <div className="grid gap-6">
        <Notice kind="info">
          Akun hanya dibuat di sini (tidak ada pendaftaran publik).{" "}
          <strong>Superadmin wajib 2FA</strong> pada login pertama; peran lain opsional. Setelah
          hari-H, nonaktifkan akun petugas.
        </Notice>
        {secret && (
          <SecretBox
            email={secret.email}
            password={secret.password}
            onClose={() => setSecret(null)}
          />
        )}
        {notice && <Notice kind="success">{notice}</Notice>}

        <Card title="Buat akun">
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Nama">
              <input
                required
                maxLength={160}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                maxLength={160}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Peran">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className={inputClass}
              >
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? "Membuat…" : "Buat akun"}
              </button>
            </div>
            {error && (
              <div className="sm:col-span-2 lg:col-span-4">
                <Notice kind="error">{error}</Notice>
              </div>
            )}
          </form>
        </Card>

        <Card title="Daftar akun">
          {list.error && <Notice kind="error">{list.error}</Notice>}
          {list.loading && <p>Memuat…</p>}
          {list.data && (
            <Table head={["Nama", "Email", "Peran", "Status", "2FA", "Dibuat", "Aksi"]}>
              {list.data.map((u) => (
                <tr key={u.id}>
                  <Td>{u.name}</Td>
                  <Td className="break-all">{u.email}</Td>
                  <Td>{ROLE_LABEL[u.role]}</Td>
                  <Td>
                    {u.is_active ? (
                      <Badge tone="green">Aktif</Badge>
                    ) : (
                      <Badge tone="red">Nonaktif</Badge>
                    )}
                  </Td>
                  <Td>
                    {u.totp_enabled ? (
                      <Badge tone="green">Aktif</Badge>
                    ) : (
                      <Badge tone="gray">Belum</Badge>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{when(u.created_at)}</Td>
                  <Td>
                    <span className="flex flex-wrap gap-2">
                      {u.is_active ? (
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() =>
                            act(
                              u,
                              "deactivate",
                              `Nonaktifkan ${u.name}? Semua sesinya dicabut.`,
                              `${u.name} dinonaktifkan.`,
                            )
                          }
                        >
                          Nonaktifkan
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() =>
                            act(
                              u,
                              "reactivate",
                              `Aktifkan kembali ${u.name}?`,
                              `${u.name} diaktifkan kembali.`,
                            )
                          }
                        >
                          Aktifkan
                        </button>
                      )}
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={() =>
                          act(
                            u,
                            "reset-password",
                            `Buat kata sandi baru untuk ${u.name}? Sandi lama dan semua sesi dicabut.`,
                            "",
                          )
                        }
                      >
                        Reset sandi
                      </button>
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={() =>
                          act(
                            u,
                            "revoke-sessions",
                            `Cabut semua sesi login ${u.name}?`,
                            "Semua sesi dicabut.",
                          )
                        }
                      >
                        Cabut sesi
                      </button>
                      {u.totp_enabled && (
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() =>
                            act(
                              u,
                              "reset-2fa",
                              `Matikan 2FA ${u.name}? Ia harus mendaftarkan ulang (untuk yang hilang HP).`,
                              "2FA direset.",
                            )
                          }
                        >
                          Reset 2FA
                        </button>
                      )}
                    </span>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
