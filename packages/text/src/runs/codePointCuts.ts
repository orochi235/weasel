/**
 * Run boundaries never cut a code point: styling snaps a range end off the
 * middle of a surrogate pair, and layout joins a pair that authored runs split
 * anyway. Grapheme clusters are not snapped: a combining mark styles alone.
 */

import type { RunSourceMap } from './textTransform';

const isHigh = (u: number): boolean => u >= 0xd800 && u <= 0xdbff;
const isLow = (u: number): boolean => u >= 0xdc00 && u <= 0xdfff;

/** The UTF-16 unit at offset `at` of the runs' texts joined, or -1 past the end. */
function unitAt(runs: readonly { text: string }[], at: number): number {
  let pos = 0;
  for (const r of runs) {
    if (at < pos + r.text.length) return r.text.charCodeAt(at - pos);
    pos += r.text.length;
  }
  return -1;
}

/** Whether offset `at` of the runs' texts joined falls between a high and a low surrogate. */
export function splitsPairAt(runs: readonly { text: string }[], at: number): boolean {
  return at > 0 && isHigh(unitAt(runs, at - 1)) && isLow(unitAt(runs, at));
}

/** `[lo, hi)` widened so neither end falls inside a surrogate pair. */
export function snapToCodePoints(runs: readonly { text: string }[], lo: number, hi: number): [number, number] {
  return [splitsPairAt(runs, lo) ? lo - 1 : lo, splitsPairAt(runs, hi) ? hi + 1 : hi];
}

/** What {@link rejoinSplitPairs} reads and rewrites of a run. */
interface PairRun { text: string; srcMap?: RunSourceMap; sizeMap?: readonly number[] }

/**
 * `runs` with every surrogate pair a run boundary splits moved whole into the
 * run holding its high surrogate, which styles it. The same array when none is
 * split; otherwise a copy of the same length, each moved run a new object.
 */
export function rejoinSplitPairs<T extends PairRun>(runs: readonly T[]): readonly T[] {
  let out: T[] | null = null;
  for (let i = 0; i < runs.length; i++) {
    const a = (out ?? runs)[i];
    if (a.text.length === 0 || !isHigh(a.text.charCodeAt(a.text.length - 1))) continue;
    let j = i + 1;
    while (j < runs.length && (out ?? runs)[j].text.length === 0) j++;
    if (j === runs.length) continue;
    const b = (out ?? runs)[j];
    if (!isLow(b.text.charCodeAt(0)) || (b.srcMap && b.srcMap.ends[0] !== 1)) continue;
    out ??= runs.slice();
    out[i] = withUnit(a, b.text[0]);
    out[j] = withoutFirst(b);
  }
  return out ?? runs;
}

function withUnit<T extends PairRun>(a: T, low: string): T {
  const next: T = { ...a, text: a.text + low };
  const last = a.text.length - 1;
  if (a.sizeMap) next.sizeMap = [...a.sizeMap, a.sizeMap[last]];
  if (a.srcMap) {
    const { length, starts, ends } = a.srcMap;
    next.srcMap = {
      length: length + 1,
      starts: [...starts, starts[last]],
      ends: [...ends.slice(0, last), length + 1, length + 1],
    };
  }
  return next;
}

function withoutFirst<T extends PairRun>(b: T): T {
  const next: T = { ...b, text: b.text.slice(1) };
  if (b.sizeMap) next.sizeMap = b.sizeMap.slice(1);
  if (b.srcMap) {
    const { length, starts, ends } = b.srcMap;
    next.srcMap = { length: length - 1, starts: starts.slice(1).map((s) => s - 1), ends: ends.slice(1).map((e) => e - 1) };
  }
  return next;
}
