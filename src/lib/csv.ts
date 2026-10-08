// CSV files: building and downloading exports, and reading imports (quoted fields with
// commas, quotes and line breaks are handled).

type Cell = string | number | boolean | null | undefined;

export function toCsv(rows: Cell[][]): string {
  const cell = (value: Cell) => {
    const text = value == null ? '' : String(value);
    return /[",\r\n]/.test(text) || /^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map(row => row.map(cell).join(',')).join('\r\n');
}

// Saves text as a file (CSV by default). The BOM makes Excel read ₹ and Telugu correctly.
export function downloadFile(content: string, filename: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([type.startsWith('text/csv') ? '﻿' + content : content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadCsv = (rows: Cell[][], filename: string) => downloadFile(toCsv(rows), filename);

// "bills_2026-09-01_to_2026-09-30.csv", or "bills_all.csv" for all time.
export function csvFilename(prefix: string, range?: { from?: string; to?: string }) {
  const period = range?.from || range?.to ? `${range.from ?? 'start'}_to_${range.to ?? 'today'}` : 'all';
  return `${prefix}_${period}.csv`;
}

// Rows of cells from CSV text.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const input = text.replace(/^﻿/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

// Records keyed by lower-case header name: [{ name: 'Aspirin', listprice: '5.5' }, ...]
export function parseCsvRecords(text: string): { headers: string[]; records: Record<string, string>[] } {
  const [header = [], ...rows] = parseCsv(text);
  const headers = header.map(h => h.trim().toLowerCase());
  return {
    headers,
    records: rows.map(cells => Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').trim()]))),
  };
}
