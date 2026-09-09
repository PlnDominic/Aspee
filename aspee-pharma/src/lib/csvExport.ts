export type CsvValue = string | number | boolean | null | undefined | Date;

function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();

  let str = String(value);

  // CSV/Excel formula injection guard (CWE-1236): a cell whose content
  // starts with =, +, -, @, or a tab/CR is interpreted as a formula by
  // Excel/Sheets when the file is opened, not displayed as text — e.g. a
  // bank statement description of "=cmd|'/c calc'!A1" from an uploaded CSV
  // would execute on whoever opens this export. Prefixing with a leading
  // apostrophe forces "treat as text" in every major spreadsheet app.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape if contains delimiter, quotes, or newline
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv<T extends Record<string, any>>(
  filename: string,
  rows: T[],
  columns: Array<{ header: string; accessor: (row: T) => CsvValue }>
) {
  if (!rows || rows.length === 0) {
    throw new Error('No data to export');
  }

  const headerRow = columns.map((c) => escapeCsvValue(c.header)).join(',');
  const dataRows = rows.map((row) => columns.map((c) => escapeCsvValue(c.accessor(row))).join(','));
  const csvContent = [headerRow, ...dataRows].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Let the browser release the object URL
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
