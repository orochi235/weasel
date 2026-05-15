/**
 * Canonical inline-styling primitive for text nodes. A node's text is
 * either a plain `string` (treated as a single-run, default-styled fragment)
 * or `StyledRun[]` for rich content. `toRuns` is the funnel that normalizes
 * either form into the array shape used by the renderer.
 *
 * Every field except `text` is optional; missing fields fall back to the
 * node-level `TextStyle`. `bold`/`italic` are toggles; richer weight axes
 * (300/500/900) are out of scope for slice 1.
 */

import type { FillStyle } from 'core/paint-types';

export interface StyledRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fill?: FillStyle;
}

export function toRuns(input: string | StyledRun[]): StyledRun[] {
  if (typeof input === 'string') {
    return input.length === 0 ? [] : [{ text: input }];
  }
  for (let i = 0; i < input.length; i++) {
    const r = input[i];
    if (typeof r?.text !== 'string') {
      throw new Error(`toRuns: run at index ${i} is missing string \`text\``);
    }
  }
  return input;
}

export function runsToPlainText(runs: readonly StyledRun[]): string {
  let out = '';
  for (const r of runs) out += r.text;
  return out;
}

function escapeMarkdown(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\*/g, '\\*');
}

export function runsToMarkdown(runs: readonly StyledRun[]): string {
  let out = '';
  for (const r of runs) {
    const escaped = escapeMarkdown(r.text);
    if (r.bold && r.italic) out += `***${escaped}***`;
    else if (r.bold) out += `**${escaped}**`;
    else if (r.italic) out += `*${escaped}*`;
    else out += escaped;
  }
  return out;
}

/**
 * Parse a small markdown subset (`**bold**`, `*italic*`, `***both***`) into
 * styled runs. Backslash escapes `\*` and `\\`. Newlines are preserved as
 * literal characters inside a run — they're not run-boundary markers in
 * this format.
 */
export function markdownToRuns(input: string): StyledRun[] {
  const runs: StyledRun[] = [];
  let bold = false;
  let italic = false;
  let buf = '';
  let i = 0;

  function flush(): void {
    if (buf.length === 0) return;
    const run: StyledRun = { text: buf };
    if (bold) run.bold = true;
    if (italic) run.italic = true;
    runs.push(run);
    buf = '';
  }

  while (i < input.length) {
    const ch = input[i];

    if (ch === '\\' && i + 1 < input.length && '*\\'.includes(input[i + 1])) {
      buf += input[i + 1];
      i += 2;
      continue;
    }

    if (ch === '*') {
      let count = 0;
      while (i + count < input.length && input[i + count] === '*') count++;
      flush();
      if (count >= 3) {
        bold = !bold;
        italic = !italic;
        i += 3;
      } else if (count === 2) {
        bold = !bold;
        i += 2;
      } else {
        italic = !italic;
        i += 1;
      }
      continue;
    }

    buf += ch;
    i++;
  }

  flush();
  return runs;
}
