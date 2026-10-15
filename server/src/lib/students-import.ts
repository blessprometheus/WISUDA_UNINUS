import type { CsvRow, ParsedCsv } from "./csv.js";

export interface ImportStudent {
  nim: string;
  name: string;
  studyProgram: string;
  cohortYear: number | null;
  graduationDateText: string | null;
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
};

const COLUMN_LABEL: Record<string, string> = {
  nim: "NIM",
  name: "Nama",
  studyProgram: "Program studi",
  cohortYear: "Angkatan",
  graduationDateText: "Tanggal lulus",
  file: "Berkas",
};

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
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

  return {
    student:
      errors.length === 0
        ? { nim, name, studyProgram, cohortYear, graduationDateText: graduationRaw || null }
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
