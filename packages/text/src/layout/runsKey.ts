/** What decides how runs lay out, as a hash and a comparison: the structural key the layout caches share. */
import { sameList } from '@weasel-js/registry';
import type { ResolvedRun } from '../runs/resolveRuns';

/** `a === b`, with NaN equal to itself, as the string key this replaced had it. */
export const same = (a: number | undefined, b: number | undefined): boolean => a === b || (a !== a && b !== b);

function mix(h: number, n: number): number {
  return Math.imul(h ^ n, 0x01000193);
}

function mixNum(h: number, x: number): number {
  return mix(h, x === (x | 0) ? x : Math.round(x * 4096));
}

function mixStr(h: number, s: string): number {
  h = mix(h, s.length);
  for (let i = 0; i < s.length; i++) h = mix(h, s.charCodeAt(i));
  return h;
}

/** A hash of everything about `runs` that changes the layout: what
 *  {@link sameRuns} compares. Built without allocating, so a miss costs a walk
 *  of the text and nothing for the collector. */
export function runsHash(runs: readonly ResolvedRun[]): number {
  let h = mix(0x811c9dc5, runs.length);
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    h = mixStr(h, r.text);
    h = mixStr(h, r.fontFamily);
    h = mixNum(h, r.fontSize);
    h = mixNum(h, r.fontWeight);
    h = mix(h, r.fontStyle === 'italic' ? 1 : 0);
    h = mixNum(h, r.letterSpacing);
    h = mixNum(h, r.baselineShift);
    h = mixNum(h, r.rotate ?? 0);
    h = mixNum(h, r.strutSize ?? -1);
    h = mix(h, r.fontFeatures?.length ?? 0);
    h = mixStr(h, r.lang ?? '');
  }
  // Cut to 30 bits, which V8 holds unboxed; a wider int32 was a heap number a layout.
  return h & 0x3fffffff;
}

const NO_STRS: readonly string[] = [];

function sameNums(a: readonly number[] | undefined, b: readonly number[] | undefined): boolean {
  return a === b || (a !== undefined && b !== undefined && sameList(a, b, same));
}

const sameStrs = (a: readonly string[] | undefined, b: readonly string[] | undefined): boolean =>
  sameList(a ?? NO_STRS, b ?? NO_STRS);

/** Whether `a` and `b` lay out alike. A run's paint and decorations are left
 *  out; `cachedPaintRuns` keys on those. */
export function sameRuns(a: readonly ResolvedRun[], b: readonly ResolvedRun[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x === y) continue;
    if (x.text !== y.text || x.fontFamily !== y.fontFamily || !same(x.fontSize, y.fontSize)
      || !same(x.fontWeight, y.fontWeight) || x.fontStyle !== y.fontStyle
      || !same(x.letterSpacing, y.letterSpacing) || !same(x.baselineShift, y.baselineShift)
      || !same(x.strutSize, y.strutSize) || !same(x.rotate ?? 0, y.rotate ?? 0) || !sameNums(x.sizeMap, y.sizeMap)
      || !sameStrs(x.fontFeatures, y.fontFeatures) || x.lang !== y.lang) return false;
    // Ends follow from starts and the length, so the two pin the cells.
    const sx = x.srcMap, sy = y.srcMap;
    if (sx !== sy && (sx === undefined || sy === undefined || sx.length !== sy.length
      || !sameNums(sx.starts, sy.starts))) return false;
  }
  return true;
}
