export interface ExportInfo {
  jsdoc: string | null;
  /** 1-based line number of the export statement. */
  line: number;
}

/** Locate the line that exports `symbol` in the supplied source string and
 *  return the JSDoc block (if any) immediately above it. Returns null if no
 *  matching export is found.
 *
 *  Recognized forms:
 *    export function NAME
 *    export const NAME
 *    export class NAME
 *    export type NAME
 *    export interface NAME
 *    export enum NAME
 *    export { NAME [as ALIAS] }
 *
 *  Line-based and intentionally simple — not a full TypeScript parser. */
export function extractExportInfo(source: string, symbol: string): ExportInfo | null {
  const lines = source.split('\n');
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`^\\s*export\\s+(function|const|class|type|interface|enum)\\s+${escaped}\\b`),
    new RegExp(`^\\s*export\\s+\\{[^}]*\\b${escaped}\\b`),
  ];
  let lineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (patterns.some((p) => p.test(lines[i]))) {
      lineIndex = i;
      break;
    }
  }
  if (lineIndex === -1) return null;
  return { jsdoc: readJsdocAbove(lines, lineIndex), line: lineIndex + 1 };
}

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

// ── Vite glob (only used in app code) ───────────────────────────────────────

type RawSourceMap = Record<string, string>;

let rawSources: RawSourceMap = {};
if (typeof (import.meta as { glob?: unknown }).glob === 'function') {
  rawSources = {
    ...(import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as RawSourceMap),
    ...(import.meta.glob('/apps/swillustrator/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as RawSourceMap),
  };
}

export interface SourceMatch {
  /** Workspace-relative path (glob key), starting with a leading slash. */
  path: string;
  /** 1-based line number of the export statement. */
  line: number;
  jsdoc: string | null;
}

/** Search every loaded source file for an export of `symbol`. Returns the
 *  first match — symbol names should be globally unique by convention. */
export function findSourceMatch(symbol: string): SourceMatch | null {
  for (const [path, source] of Object.entries(rawSources)) {
    const info = extractExportInfo(source, symbol);
    if (info) return { path, line: info.line, jsdoc: info.jsdoc };
  }
  return null;
}
