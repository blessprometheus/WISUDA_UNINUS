import type { CsvRow, ParsedCsv } from "./csv.js";

export interface ImportStudent {
  nim: string;
  name: string;
  studyProgram: string;
  cohortYear: number | null;
  graduationDateText: string | null;
  isPaid: boolean | null;
  isYudisium: boolean | null;
  eligibilityNote: string | null;
}

export interface ImportIssue {
  row: number;
  column: string;
  message: string;
}

export interface ImportAnalysis {
  valid: Array<{ row: number; student: ImportStudent }>;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  ignoredColumns: string[];
  totalRows: number;
}

export const NIM_PATTERN = /^[0-9A-Za-z.-]{1,30}$/;

const HEADER_ALIASES: Record<string, keyof ImportStudent | "no"> = {
  no: "no",
  nim: "nim",
  nama: "name",
  nama_lengkap: "name",
  name: "name",
  program_studi: "studyProgram",
  prodi: "studyProgram",
  study_program: "studyProgram",
  angkatan: "cohortYear",
  cohort_year: "cohortYear",
  tanggal_lulus: "graduationDateText",
  graduation_date: "graduationDateText",
  pembayaran: "isPaid",
  status_pembayaran: "isPaid",
  keuangan: "isPaid",
  status_keuangan: "isPaid",
  is_paid: "isPaid",
  lunas: "isPaid",
  yudisium: "isYudisium",
  status_yudisium: "isYudisium",
  is_yudisium: "isYudisium",
  catatan: "eligibilityNote",
  catatan_kelayakan: "eligibilityNote",
  keterangan: "eligibilityNote",
  alasan: "eligibilityNote",
  eligibility_note: "eligibilityNote",
};

const COLUMN_LABEL: Record<string, string> = {
  nim: "NIM",
  name: "Nama",
  studyProgram: "Program studi",
  cohortYear: "Angkatan",
  graduationDateText: "Tanggal lulus",
  isPaid: "Status pembayaran",
  isYudisium: "Status yudisium",
  eligibilityNote: "Catatan kelayakan",
  file: "Berkas",
};

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function parseBooleanCell(raw: string): boolean | "invalid" | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (
    [
      "1",
      "ya",
      "yes",
      "true",
      "lunas",
      "sudah",
      "lulus",
      "selesai",
      "ok",
      "valid",
      "eligible",
      "layak",
      "terverifikasi",
    ].includes(v)
  ) {
    return true;
  }
  if (
    [
      "0",
      "tidak",
      "no",
      "false",
      "belum",
      "belum lunas",
      "belum_lunas",
      "tunggakan",
      "pending",
      "kurang",
      "belum yudisium",
      "belum_yudisium",
    ].includes(v)
  ) {
    return false;
  }
  return "invalid";
}

function parseRow(
  row: CsvRow,
  columns: ReadonlyMap<keyof ImportStudent, number>,
  headerLength: number,
): { student: ImportStudent | null; errors: ImportIssue[] } {
  const errors: ImportIssue[] = [];
  if (row.cells.length !== headerLength) {
    return {
      student: null,
      errors: [{ row: row.line, column: "file", message: "Jumlah kolom tidak sama dengan judul." }],
    };
  }
  const get = (key: keyof ImportStudent): string => {
    const index = columns.get(key);
    return index === undefined ? "" : (row.cells[index]?.trim() ?? "");
  };

  const nim = get("nim").toUpperCase();
  const name = get("name");
  const studyProgram = get("studyProgram");
  if (!nim || !NIM_PATTERN.test(nim)) {
    errors.push({
      row: row.line,
      column: "nim",
      message: "Wajib diisi; hanya huruf, angka, titik, atau strip (maksimal 30).",
    });
  }
  if (!name || name.length > 160) {
    errors.push({ row: row.line, column: "name", message: "Wajib diisi, maksimal 160 karakter." });
  }
  if (!studyProgram || studyProgram.length > 160) {
    errors.push({
      row: row.line,
      column: "studyProgram",
      message: "Wajib diisi, maksimal 160 karakter.",
    });
  }

  const cohortRaw = get("cohortYear");
  let cohortYear: number | null = null;
  if (cohortRaw) {
    const year = Number(cohortRaw);
    if (!Number.isInteger(year) || year < 1990 || year > 2100) {
      errors.push({
        row: row.line,
        column: "cohortYear",
        message: "Angkatan harus tahun 4 digit (1990–2100).",
      });
    } else {
      cohortYear = year;
    }
  }

  const graduationRaw = get("graduationDateText");
  if (graduationRaw.length > 40) {
    errors.push({ row: row.line, column: "graduationDateText", message: "Maksimal 40 karakter." });
  }

  const paidParsed = parseBooleanCell(get("isPaid"));
  let isPaid: boolean | null = null;
  if (paidParsed === "invalid") {
    errors.push({
      row: row.line,
      column: "isPaid",
      message: "Gunakan LUNAS/BELUM atau YA/TIDAK atau 1/0.",
    });
  } else {
    isPaid = paidParsed;
  }

  const yudisiumParsed = parseBooleanCell(get("isYudisium"));
  let isYudisium: boolean | null = null;
  if (yudisiumParsed === "invalid") {
    errors.push({
      row: row.line,
      column: "isYudisium",
      message: "Gunakan SUDAH/BELUM atau YA/TIDAK atau 1/0.",
    });
  } else {
    isYudisium = yudisiumParsed;
  }

  const noteRaw = get("eligibilityNote");
  if (noteRaw.length > 500) {
    errors.push({
      row: row.line,
      column: "eligibilityNote",
      message: "Catatan maksimal 500 karakter.",
    });
  }

  return {
    student:
      errors.length === 0
        ? {
            nim,
            name,
            studyProgram,
            cohortYear,
            graduationDateText: graduationRaw || null,
            isPaid,
            isYudisium,
            eligibilityNote: noteRaw || null,
          }
        : null,
    errors,
  };
}

/**
 * Analisis berkas tanpa menyentuh database. Aturan NIM ganda (data BAAK terbukti memuat NIM ganda):
 * - baris identik (nama + prodi sama) → satu dipakai, diberi peringatan;
 * - baris berbeda → SEMUA baris dengan NIM itu ditolak agar manusia yang memutuskan mana yang benar.
 */
export function analyzeImport(parsed: ParsedCsv): ImportAnalysis {
  const columns = new Map<keyof ImportStudent, number>();
  const ignoredColumns: string[] = [];
  parsed.header.forEach((raw, index) => {
    const alias = HEADER_ALIASES[normalizeHeader(raw)];
    if (alias && alias !== "no" && !columns.has(alias)) columns.set(alias, index);
    else if (!alias && raw.trim()) ignoredColumns.push(raw.trim());
  });
  const missing = (["nim", "name", "studyProgram"] as const).filter((key) => !columns.has(key));
  if (missing.length > 0) {
    return {
      valid: [],
      errors: [
        {
          row: 1,
          column: "file",
          message: `Kolom wajib tidak ditemukan: ${missing.map((key) => COLUMN_LABEL[key]).join(", ")}.`,
        },
      ],
      warnings: [],
      ignoredColumns,
      totalRows: parsed.rows.length,
    };
  }

  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const byNim = new Map<string, Array<{ row: number; student: ImportStudent }>>();
  for (const row of parsed.rows) {
    const result = parseRow(row, columns, parsed.header.length);
    errors.push(...result.errors);
    if (!result.student) continue;
    const list = byNim.get(result.student.nim) ?? [];
    list.push({ row: row.line, student: result.student });
    byNim.set(result.student.nim, list);
  }

  const valid: Array<{ row: number; student: ImportStudent }> = [];
  for (const [nim, entries] of byNim) {
    const first = entries[0]!;
    if (entries.length === 1) {
      valid.push(first);
      continue;
    }
    const rows = entries.map((entry) => entry.row).join(", ");
    const identical = entries.every(
      (entry) =>
        entry.student.name === first.student.name &&
        entry.student.studyProgram === first.student.studyProgram,
    );
    if (identical) {
      valid.push(first);
      warnings.push({
        row: first.row,
        column: "nim",
        message: `NIM ${nim} muncul ganda dengan data identik (baris ${rows}); satu dipakai.`,
      });
    } else {
      errors.push({
        row: first.row,
        column: "nim",
        message: `NIM ${nim} ganda dengan data berbeda (baris ${rows}); semua baris ditolak, periksa data sumber.`,
      });
    }
  }
  valid.sort((a, b) => a.row - b.row);
  return { valid, errors, warnings, ignoredColumns, totalRows: parsed.rows.length };
}

export interface FinanceSyncItem {
  nim: string;
  isPaid: boolean | null;
  isYudisium: boolean | null;
  eligibilityNote: string | null;
}

export interface FinanceSyncAnalysis {
  valid: Array<{ row: number; item: FinanceSyncItem }>;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  ignoredColumns: string[];
  totalRows: number;
}

/**
 * Analisis berkas spreadsheet keuangan/yudisium (cukup kolom NIM dan minimal satu dari PEMBAYARAN / YUDISIUM / CATATAN).
 */
export function analyzeFinanceSync(parsed: ParsedCsv): FinanceSyncAnalysis {
  const columns = new Map<keyof ImportStudent, number>();
  const ignoredColumns: string[] = [];
  parsed.header.forEach((raw, index) => {
    const alias = HEADER_ALIASES[normalizeHeader(raw)];
    if (alias && alias !== "no" && !columns.has(alias)) columns.set(alias, index);
    else if (!alias && raw.trim()) ignoredColumns.push(raw.trim());
  });

  if (!columns.has("nim")) {
    return {
      valid: [],
      errors: [{ row: 1, column: "file", message: "Kolom wajib tidak ditemukan: NIM." }],
      warnings: [],
      ignoredColumns,
      totalRows: parsed.rows.length,
    };
  }
  if (!columns.has("isPaid") && !columns.has("isYudisium") && !columns.has("eligibilityNote")) {
    return {
      valid: [],
      errors: [
        {
          row: 1,
          column: "file",
          message:
            "Sertakan minimal satu kolom status: PEMBAYARAN (LUNAS/BELUM), YUDISIUM (SUDAH/BELUM), atau CATATAN.",
        },
      ],
      warnings: [],
      ignoredColumns,
      totalRows: parsed.rows.length,
    };
  }

  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const byNim = new Map<string, Array<{ row: number; item: FinanceSyncItem }>>();

  for (const row of parsed.rows) {
    if (row.cells.length !== parsed.header.length) {
      errors.push({
        row: row.line,
        column: "file",
        message: "Jumlah kolom tidak sama dengan judul.",
      });
      continue;
    }
    const get = (key: keyof ImportStudent): string => {
      const index = columns.get(key);
      return index === undefined ? "" : (row.cells[index]?.trim() ?? "");
    };
    const nim = get("nim").toUpperCase();
    const rowErrors: ImportIssue[] = [];
    if (!nim || !NIM_PATTERN.test(nim)) {
      rowErrors.push({
        row: row.line,
        column: "nim",
        message: "Wajib diisi; hanya huruf, angka, titik, atau strip (maksimal 30).",
      });
    }
    const paidParsed = parseBooleanCell(get("isPaid"));
    let isPaid: boolean | null = null;
    if (paidParsed === "invalid") {
      rowErrors.push({
        row: row.line,
        column: "isPaid",
        message: "Gunakan LUNAS/BELUM atau YA/TIDAK atau 1/0.",
      });
    } else {
      isPaid = paidParsed;
    }

    const yudisiumParsed = parseBooleanCell(get("isYudisium"));
    let isYudisium: boolean | null = null;
    if (yudisiumParsed === "invalid") {
      rowErrors.push({
        row: row.line,
        column: "isYudisium",
        message: "Gunakan SUDAH/BELUM atau YA/TIDAK atau 1/0.",
      });
    } else {
      isYudisium = yudisiumParsed;
    }

    const noteRaw = get("eligibilityNote");
    if (noteRaw.length > 500) {
      rowErrors.push({
        row: row.line,
        column: "eligibilityNote",
        message: "Catatan maksimal 500 karakter.",
      });
    }

    errors.push(...rowErrors);
    if (rowErrors.length > 0) continue;

    const list = byNim.get(nim) ?? [];
    list.push({
      row: row.line,
      item: { nim, isPaid, isYudisium, eligibilityNote: noteRaw || null },
    });
    byNim.set(nim, list);
  }

  const valid: Array<{ row: number; item: FinanceSyncItem }> = [];
  for (const [nim, entries] of byNim) {
    const last = entries.at(-1)!;
    if (entries.length > 1) {
      warnings.push({
        row: last.row,
        column: "nim",
        message: `NIM ${nim} muncul ${entries.length} kali; baris terakhir (baris ${last.row}) dipakai.`,
      });
    }
    valid.push(last);
  }
  valid.sort((a, b) => a.row - b.row);
  return { valid, errors, warnings, ignoredColumns, totalRows: parsed.rows.length };
}
