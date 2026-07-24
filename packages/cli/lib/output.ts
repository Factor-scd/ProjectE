type Column = { key: string; label: string; width?: number; align?: 'left' | 'right' };

export function printTable(rows: Record<string, unknown>[], columns: Column[]): void {
  if (rows.length === 0) {
    console.log('(no records)');
    return;
  }

  // Calculate widths
  const widths = columns.map((col) => {
    if (col.width) return col.width;
    const headerLen = col.label.length;
    const maxDataLen = rows.reduce((max, row) => {
      const val = String(row[col.key] ?? '');
      return Math.max(max, val.length);
    }, 0);
    return Math.max(headerLen, maxDataLen);
  });

  // Print header
  const header = columns.map((col, i) => col.label.padEnd(widths[i])).join('  ');
  console.log(header);
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));

  // Print rows
  for (const row of rows) {
    const line = columns.map((col, i) => {
      const val = String(row[col.key] ?? '');
      return col.align === 'right' ? val.padStart(widths[i]) : val.padEnd(widths[i]);
    }).join('  ');
    console.log(line);
  }
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printSuccess(message: string): void {
  console.log(`✓ ${message}`);
}

export function printError(message: string): void {
  console.error(`✗ ${message}`);
}

export function printHeader(message: string): void {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${message}`);
  console.log(`${'='.repeat(50)}`);
}
