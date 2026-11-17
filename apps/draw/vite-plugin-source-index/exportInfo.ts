import type { SourceIndex, SourceMatch } from '../src/dev/sourceIndex.types.ts';

function readJsdocAbove(lines: string[], exportLineIndex: number): string | null {
  // Walk upward past blank lines.
  let i = exportLineIndex - 1;
  while (i >= 0 && lines[i].trim() === '') i--;
  if (i < 0) return null;
  const last = lines[i].trim();
  if (last === '*/') {
    const collected: string[] = [];
    let j = i;
    while (j >= 0) {
      collected.unshift(lines[j]);
      if (lines[j].trim().startsWith('/**')) break;
      j--;
    }
    if (j < 0) return null;
    return collected
      .map((l) => l.replace(/^\s*\/?\*+\/?\s?/, '').replace(/\s+$/, ''))
      .join('\n')
      .trim() || null;
  }
  const single = /^\/\*\*\s*(.+?)\s*\*\/$/.exec(last);
  if (single) return single[1];
  return null;
}

const DECLARATION =
  /^\s*export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|class|abstract\s+class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/;
const LIST = /^\s*export\s+(?:type\s+)?\{([^}]*)\}/;

/** Index every export in `files` (path → source) by name. A declaration wins
 *  over an `export { … }` list naming the same symbol, so a barrel's re-export
 *  never hides where the symbol is written; otherwise the first path in sort
 *  order wins. */
export function indexExports(files: Readonly<Record<string, string>>): SourceIndex {
  const index = new Map<string, SourceMatch>();
  const listed = new Map<string, SourceMatch>();
  for (const path of Object.keys(files).sort()) {
    const lines = files[path]!.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const declared = DECLARATION.exec(lines[i]!);
      if (declared) {
        const name = declared[1]!;
        if (!index.has(name)) index.set(name, { path, line: i + 1, jsdoc: readJsdocAbove(lines, i) });
        continue;
      }
      const list = LIST.exec(lines[i]!);
      if (!list) continue;
      for (const part of list[1]!.split(',')) {
        const name = /([A-Za-z_$][\w$]*)\s*$/.exec(part.trim())?.[1];
        if (name && name !== 'type' && !listed.has(name)) listed.set(name, { path, line: i + 1, jsdoc: readJsdocAbove(lines, i) });
      }
    }
  }
  for (const [name, match] of listed) if (!index.has(name)) index.set(name, match);
  return Object.fromEntries(index);
}
