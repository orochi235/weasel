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

import type { Paint } from 'core/paint-types';

export interface StyledRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fill?: Paint;
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
