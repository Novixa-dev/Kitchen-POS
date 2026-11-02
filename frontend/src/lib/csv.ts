/**
 * CSV export.
 *
 * Two things the previous inline `data:text/csv,…` export got wrong:
 *
 *  1. No byte-order mark. Excel assumes the system code page for a CSV with
 *     no BOM, so Arabic item names and the currency symbol arrived as
 *     mojibake.
 *  2. No escaping. An item name containing a comma, a quote or a newline —
 *     all legal in a dish name — silently broke the column alignment.
 */

/** U+FEFF, written as an escape so the source file itself stays plain ASCII. */
const BOM = '﻿';

export type CsvValue = string | number | boolean | null | undefined;

/** Quote a single field per RFC 4180. */
function escapeField(value: CsvValue): string {
  const text = value === null || value === undefined ? '' : String(value);
  // Quote when the value contains a delimiter, a quote or a line break.
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows: CsvValue[][]): string {
  // CRLF is what Excel expects.
  return rows.map(row => row.map(escapeField).join(',')).join('\r\n');
}

/** Trigger a download of `rows` as a UTF-8 CSV file. */
export function downloadCsv(filename: string, rows: CsvValue[][]): void {
  const blob = new Blob([BOM + toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Release the blob once the browser has started the download.
  URL.revokeObjectURL(url);
}
