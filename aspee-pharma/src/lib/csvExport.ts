export type CsvValue = string | number | boolean | null | undefined | Date;

function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();

  const str = String(value);
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
