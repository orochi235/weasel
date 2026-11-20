import type { DataNode } from '@weasel-js/diagram';

/** A node's text, one line per text row. A header is its title, then its `aside` after a space. A divider is left out
 *  quietly, since it holds no text; `dropped` is called for a port row or slot, which do. */
export function rowLines(node: DataNode, dropped: () => void): string[] {
  if (node.rows === undefined) return [...(node.lines ?? [])];
  const lines: string[] = [];
  for (const row of node.rows) {
    if (row.kind === 'label') lines.push(row.text);
    else if (row.kind === 'header') lines.push(row.aside !== undefined && row.aside !== '' ? `${row.text} ${row.aside}` : row.text);
    else if (row.kind === 'field') lines.push(`${row.label}: ${row.value}`);
    else if (row.kind !== 'divider') dropped();
  }
  return lines;
}
