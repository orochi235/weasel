/**
 * Range-addressed styling over `StyledRun[]`. The panel addresses node paths;
 * a caret addresses a character range — these are the functions for the
 * second case. Pure and React-free so the semantics are unit-testable, the
 * same split `SelectionPanel` makes between `model.ts` and its component.
 *
 * Character offsets index the concatenated run text (`runsToPlainText`), and
 * a range is half-open: `[start, end)`. Ranges are clamped, never wrapped —
 * a negative `start` clamps to 0, an `end` past the text clamps to its
 * length, and a collapsed or inverted range (`start >= end`) is empty.
 */

import type { StyledRun } from '../runs';

/** Sentinel for "the runs in this range disagree at this key." */
export const MIXED_STYLE: unique symbol = Symbol('weasel:mixed-style');
export type MixedStyle = typeof MIXED_STYLE;

/** Every styleable key of a run, each either a concrete value or MIXED_STYLE. */
export type RangeStyle = {
  [K in Exclude<keyof StyledRun, 'text'>]?: StyledRun[K] | MixedStyle;
};

/**
 * What `applyStyleToRange` writes. `text` is deliberately not part of it —
 * this is a styling operation, not an edit.
 */
export type RunStylePatch = Partial<Omit<StyledRun, 'text'>>;

type StyleKey = Exclude<keyof StyledRun, 'text'>;

const STYLE_KEYS: readonly StyleKey[] = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'fontFamily',
  'fontSize',
  'letterSpacing',
  'fill',
];

/** Keys where absent and `false` mean the same thing, so they read as `false`. */
const FLAG_KEYS: ReadonlySet<StyleKey> = new Set<StyleKey>([
  'bold',
  'italic',
  'underline',
  'strikethrough',
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Structural equality over the JSON-ish values a run can hold. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((k) => k in b && deepEqual(a[k], b[k]));
  }
  return false;
}

/** A run's value at `key`, with flags normalized so absent reads as `false`. */
function valueAt(run: StyledRun, key: StyleKey): StyledRun[StyleKey] {
  const value = run[key];
  if (FLAG_KEYS.has(key)) return (value as boolean | undefined) ?? false;
  return value;
}

function sameValue(key: StyleKey, a: unknown, b: unknown): boolean {
  // `fill` is the only structural value; the rest are primitives, and
  // `applyStyleToRange` spreads runs, so reference identity isn't reliable.
  return key === 'fill' ? deepEqual(a, b) : Object.is(a, b);
}

/** Do two runs carry the same styling (their `text` aside)? */
function sameStyle(a: StyledRun, b: StyledRun): boolean {
  return STYLE_KEYS.every((key) => sameValue(key, valueAt(a, key), valueAt(b, key)));
}

/** Total character length of a run array — the domain of its offsets. */
function totalLength(runs: readonly StyledRun[]): number {
  let n = 0;
  for (const run of runs) n += run.text.length;
  return n;
}

/**
 * The styling shared by every run overlapping `[start, end)`: a concrete
 * value where the range agrees, `MIXED_STYLE` where it doesn't. Keys no run
 * in range sets are absent (they inherit the node's `TextStyle`) — except
 * the boolean flags, which read as `false` rather than `undefined` since a
 * run cannot un-set them. An empty range reads as `{}`.
 */
export function styleAtRange(
  runs: readonly StyledRun[],
  start: number,
  end: number,
): RangeStyle {
  const lo = Math.max(0, start);
  const hi = end;
  // Negated `<` rather than `>=` so a non-numeric offset reads as empty
  // instead of matching every run.
  if (!(lo < hi)) return {};

  const first = new Map<StyleKey, unknown>();
  const mixed = new Set<StyleKey>();
  let seen = false;
  let pos = 0;

  for (const run of runs) {
    const runEnd = pos + run.text.length;
    const a = Math.max(pos, lo);
    const b = Math.min(runEnd, hi);
    pos = runEnd;
    if (!(a < b)) continue;

    for (const key of STYLE_KEYS) {
      const value = valueAt(run, key);
      if (!seen) first.set(key, value);
      else if (!mixed.has(key) && !sameValue(key, first.get(key), value)) {
        mixed.add(key);
      }
    }
    seen = true;
  }

  if (!seen) return {};

  const style: Record<string, unknown> = {};
  for (const key of STYLE_KEYS) {
    if (mixed.has(key)) style[key] = MIXED_STYLE;
    else {
      const value = first.get(key);
      if (value !== undefined) style[key] = value;
    }
  }
  return style as RangeStyle;
}

/** Apply `patch` to one run, deleting rather than storing "no override". */
function patchRun(run: StyledRun, patch: RunStylePatch): StyledRun {
  const next: StyledRun = { ...run };
  for (const key of STYLE_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    // `false` and `undefined` both mean "no run-level override", and a run
    // that stores one would never coalesce with an equivalent neighbor.
    if (value === undefined || value === false) delete next[key];
    else (next as unknown as Record<string, unknown>)[key] = value;
  }
  return next;
}

/** Merge neighbors that ended up styled identically; drop empty runs. */
function coalesceRuns(runs: readonly StyledRun[]): StyledRun[] {
  const out: StyledRun[] = [];
  for (const run of runs) {
    if (run.text.length === 0) continue;
    const prev = out[out.length - 1];
    if (prev && sameStyle(prev, run)) prev.text += run.text;
    else out.push({ ...run });
  }
  return out;
}

/**
 * Write `patch` over `[start, end)`, splitting runs at the boundaries and
 * coalescing neighbors that end up identical. A patch value of `undefined`
 * or `false` deletes the key instead of storing it — a run has no way to
 * express "not bold" against a bold node style, so storing `false` would
 * only block coalescing.
 *
 * Returns a new array; the input and its runs are never mutated. Coalescing
 * normalizes the whole array, not just the patched span — identical
 * neighbors merge and empty runs are dropped wherever they sit. An empty
 * range short-circuits to a copy of `runs` without that normalization.
 */
export function applyStyleToRange(
  runs: readonly StyledRun[],
  start: number,
  end: number,
  patch: RunStylePatch,
): StyledRun[] {
  const lo = Math.max(0, start);
  const hi = Math.min(totalLength(runs), end);
  if (!(lo < hi)) return runs.map((run) => ({ ...run }));

  const out: StyledRun[] = [];
  let pos = 0;
  for (const run of runs) {
    const runEnd = pos + run.text.length;
    const a = Math.max(pos, lo);
    const b = Math.min(runEnd, hi);
    if (a < b) {
      if (pos < a) out.push({ ...run, text: run.text.slice(0, a - pos) });
      out.push(patchRun({ ...run, text: run.text.slice(a - pos, b - pos) }, patch));
      if (b < runEnd) out.push({ ...run, text: run.text.slice(b - pos) });
    } else {
      out.push({ ...run });
    }
    pos = runEnd;
  }

  return coalesceRuns(out);
}
