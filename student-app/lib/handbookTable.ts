export type HandbookTable = { headers: string[]; rows: string[][] };

function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\' && (line[i + 1] === '|' || line[i + 1] === '\\')) {
      cell += line[++i];
    } else if (line[i] === '|') {
      cells.push(cell.trim()); cell = '';
    } else cell += line[i];
  }
  cells.push(cell.trim());
  if (line.trimStart().startsWith('|')) cells.shift();
  if (line.trimEnd().endsWith('|') && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

export function parseHandbookTable(block: string): HandbookTable | null {
  const lines = block.trim().split(/\r?\n/);
  if (lines.length < 2 || !lines[0].includes('|')) return null;
  const headers = splitRow(lines[0]);
  const divider = splitRow(lines[1]);
  if (!headers.length || divider.length !== headers.length || !divider.every(cell => /^:?-{3,}:?$/.test(cell))) return null;
  const rows = lines.slice(2).map(splitRow);
  if (rows.some(row => row.length !== headers.length)) return null;
  return { headers, rows };
}

export function serializeHandbookTable(headers: string[], rows: string[][]): string {
  const escape = (cell: string) => cell.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').trim();
  const row = (cells: string[]) => `| ${cells.map(escape).join(' | ')} |`;
  return [row(headers), row(headers.map(() => '---')), ...rows.map(cells => row(headers.map((_, i) => cells[i] || '')))].join('\n');
}
