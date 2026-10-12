/** Text going into runs at a character range, for typing under an armed style and for a paste. */

import { applyStyleToRange, type RunStylePatch, type StyledRun } from '@weasel-js/text';

/**
 * `runs` with the characters `[start, end)` replaced by `insert`, splitting
 * whichever runs span the two ends. The result is normalized (empty runs
 * dropped, identical neighbors merged) by the same algebra every other write
 * goes through.
 */
export function replaceRunRange(
  runs: readonly StyledRun[],
  start: number,
  end: number,
  insert: readonly StyledRun[],
): StyledRun[] {
  const out: StyledRun[] = [];
  let pos = 0;
  let placed = false;
  const place = (): void => {
    if (!placed) out.push(...insert.map((r) => ({ ...r })));
    placed = true;
  };
  for (const r of runs) {
    const from = pos;
    pos += r.text.length;
    if (from < start) out.push({ ...r, text: r.text.slice(0, start - from) });
    if (pos >= start) place();
    if (pos > end) out.push({ ...r, text: r.text.slice(Math.max(0, end - from)) });
  }
  place();
  // An empty patch over an empty range: this is the array-wide normalization
  // pass, not a styling.
  return applyStyleToRange(out, 0, 0, {});
}

/**
 * The styling a character typed at offset `at` joins: the run to its left's,
 * or the first run's at the very start of the text.
 */
export function runStyleAt(runs: readonly StyledRun[], at: number): RunStylePatch {
  let pos = 0;
  let found: StyledRun | undefined = runs[0];
  for (const r of runs) {
    if (r.text.length === 0) continue;
    if (pos >= at && pos > 0) break;
    found = r;
    pos += r.text.length;
  }
  if (!found) return {};
  const style: Partial<StyledRun> = { ...found };
  delete style.text;
  return style;
}
