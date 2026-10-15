// Diadaptasi dari server/src/lib/csv.ts proyek PKKMB (ADR-0009), sudah diaudit: parser CSV UTF-8
// tanpa menafsirkan rumus, dan escape ekspor yang mencegah formula injection.

export interface CsvRow {
  /** Nomor baris di berkas (mulai 1; baris judul = 1). */
  line: number;
  cells: string[];
}

export interface ParsedCsv {
  header: string[];
  rows: CsvRow[];
}

function detectDelimiter(input: string): "," | ";" {
  let quoted = false;
  let commas = 0;
  let semicolons = 0;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && (character === "\r" || character === "\n")) {
      break;
    } else if (!quoted && character === ",") {
      commas += 1;
    } else if (!quoted && character === ";") {
      semicolons += 1;
    }
  }
  return semicolons > commas ? ";" : ",";
}

export class CsvError extends Error {}

/** Parse CSV UTF-8. Baris kosong dilewati; tidak memangkas atau menafsirkan isi sel. */
export function parseCsv(buffer: Buffer, maxRows: number): ParsedCsv {
  let input: string;
  try {
    input = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new CsvError("Berkas harus berformat CSV UTF-8.");
  }
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);
  if (input.includes("\0")) throw new CsvError("Berkas CSV mengandung karakter tidak valid.");

  const delimiter = detectDelimiter(input);
  const records: CsvRow[] = [];
  let cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let afterQuote = false;
  let line = 1;
  let recordLine = 1;

  function finishCell(): void {
    cells.push(cell);
    cell = "";
    afterQuote = false;
  }

  function finishRecord(): void {
    finishCell();
    if (cells.some((value) => value.trim() !== "")) {
      records.push({ line: recordLine, cells });
      if (records.length > maxRows + 1) {
        throw new CsvError(`Berkas CSV melebihi batas ${maxRows} baris.`);
      }
    }
    cells = [];
    recordLine = line + 1;
  }

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (inQuotes) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else {
        cell += character;
        if (character === "\n") line += 1;
      }
      continue;
    }
    if (character === '"') {
      if (cell !== "" || afterQuote)
        throw new CsvError(`Format tanda kutip tidak valid pada baris ${line}.`);
      inQuotes = true;
    } else if (character === delimiter) {
      finishCell();
    } else if (character === "\r" || character === "\n") {
      finishRecord();
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      line += 1;
    } else if (afterQuote) {
      throw new CsvError(`Format CSV tidak valid pada baris ${line}.`);
    } else {
      cell += character;
    }
  }
  if (inQuotes) throw new CsvError("Berkas CSV memiliki tanda kutip yang belum ditutup.");
  if (cell !== "" || cells.length > 0 || afterQuote) finishRecord();

  const [header, ...rows] = records;
  if (!header || rows.length === 0) {
    throw new CsvError("Berkas CSV harus memuat judul kolom dan setidaknya satu baris data.");
  }
  return { header: header.cells, rows };
}

/** Escape sel CSV; sel yang diawali = + - @ diberi apostrof agar tidak dieksekusi sebagai rumus. */
export function escapeCsvCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  let first = 0;
  while (first < raw.length && (raw[first]?.trim() === "" || raw.charCodeAt(first) < 32))
    first += 1;
  const isFormula = first < raw.length && "=+-@".includes(raw[first]!);
  const safe = isFormula ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function formatCsv(rows: readonly unknown[][]): string {
  return `﻿${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}\r\n`;
}
