/**
 * Range-addressed styling over `StyledRun[]`.
 *
 * Character offsets index the concatenated run text (`runsToPlainText`), and
 * a range is half-open: `[start, end)`. Ranges are clamped, never wrapped,
 * and a collapsed or inverted range (`start >= end`) is empty. Offsets are
 * UTF-16 code units, so a boundary can bisect a surrogate pair.
 *
 * **Run-level flags are additive over the node's `TextStyle`: a run can
 * turn `bold` / `italic` / `underline` / `strikethrough` on, never off.**
 * So a flag is stored only when true, and absent reads as `false`. A run
 * that must be lighter than a bold node says so with its own numeric
 * `fontWeight`, which `bold` is a preset over (see {@link supersededKey}).
 * The decorations have no such primitive, and the tri-state is collapsed by
 * choice, to keep one canonical form per styling. Resolution must therefore
 * read decorations as `run.underline || style.underline`, not `??`.
 *
 * Copies here are shallow: a `fill` object is shared by reference between
 * the input runs, the patch, every run the patch touched, and the value
 * `styleAtRange` reports. Treat `fill` values as immutable.
 */

import { MIXED, deepEqual } from '@weasel-js/registry';
import type { Mixed } from '@weasel-js/registry';
import type { StyledRun } from '../runs';

export { MIXED };
export type { Mixed };

/** Every styleable key of a run, each either a concrete value or MIXED (the
 *  runs in the range disagree at that key). */
export type RangeStyle = {
  [K in Exclude<keyof StyledRun, 'text'>]?: StyledRun[K] | Mixed;
};

/** What `applyStyleToRange` writes. */
export type RunStylePatch = Partial<Omit<StyledRun, 'text'>>;

/** Every key of a run that carries styling — i.e. everything but `text`. */
export type StyleKey = Exclude<keyof StyledRun, 'text'>;

const STYLE_KEYS = [
  'bold',
  'fontWeight',
  'italic',
  'underline',
  'strikethrough',
  'overline',
  'fontFamily',
  'fontSize',
  'letterSpacing',
  'fill',
  'stroke',
  'script',
  'baselineShift',
  'fontScale',
  'textTransform',
  'fontVariantCaps',
  'rotate',
] as const satisfies readonly StyleKey[];

// A key missing from STYLE_KEYS is invisible to every function here.
// `satisfies` only checks the entries that ARE listed, so this makes adding a
// key to `StyledRun` without adding it here a compile error.
type MissingStyleKey = Exclude<StyleKey, (typeof STYLE_KEYS)[number]>;
type AssertNoMissingStyleKey = [MissingStyleKey] extends [never] ? true : never;
const STYLE_KEYS_ARE_EXHAUSTIVE: AssertNoMissingStyleKey = true;
void STYLE_KEYS_ARE_EXHAUSTIVE;

/** The additive flags: absent and `false` mean the same thing, so both read as `false`. */
const FLAG_KEYS: ReadonlySet<StyleKey> = new Set<StyleKey>([
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'overline',
]);

/** A run's value at `key`, with flags normalized so absent reads as `false`. */
function valueAt(run: StyledRun, key: StyleKey): StyledRun[StyleKey] {
  const value = run[key];
  if (FLAG_KEYS.has(key)) return (value as boolean | undefined) ?? false;
  return value;
}

/** The structural values. Everything else is a primitive, and
 *  `applyStyleToRange` spreads runs, so reference identity isn't reliable. */
const STRUCTURAL_KEYS: ReadonlySet<StyleKey> = new Set<StyleKey>(['fill', 'stroke']);

function sameValue(key: StyleKey, a: unknown, b: unknown): boolean {
  return STRUCTURAL_KEYS.has(key) ? deepEqual(a, b) : Object.is(a, b);
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
 * value where the range agrees, `MIXED` where it doesn't. Keys no run
 * in range sets are absent (they inherit the node's `TextStyle`) — except
 * the additive flags, which read as `false`. An empty range reads as `{}`.
 * A reported `fill` is the run's own object, not a copy.
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
    if (mixed.has(key)) style[key] = MIXED;
    else {
      const value = first.get(key);
      if (value !== undefined) style[key] = value;
    }
  }
  return style as RangeStyle;
}

/**
 * Does any run carry styling of its own? A flag stored as `false` counts as
 * none, so runs whose styling was toggled back off read as `false`.
 */
export function runsCarryStyling(runs: readonly StyledRun[]): boolean {
  return runs.some((run) =>
    STYLE_KEYS.some((key) => {
      const value = run[key];
      return value !== undefined && value !== false;
    }),
  );
}

/**
 * The key a patch clears without naming it. `bold` is a preset over
 * `fontWeight`, and a run keeps at most one of the two: writing either drops
 * the other, so a Bold toggle is not hidden under a weight it cannot beat and
 * a picked weight is not shadowed by a stale flag. Naming both writes both.
 */
export function supersededKey(patch: RunStylePatch): 'bold' | 'fontWeight' | undefined {
  if ('bold' in patch && !('fontWeight' in patch)) return 'fontWeight';
  if (patch.fontWeight !== undefined && !('bold' in patch)) return 'bold';
  return undefined;
}

/**
 * `range` with `patch` laid over it, keyed as a write of `patch` would leave
 * the runs — for showing styling armed for the next keystroke over the
 * styling at the caret. A key the patch leaves `undefined` keeps the range's
 * value; the key it supersedes is dropped.
 */
export function patchRangeStyle(range: RangeStyle, patch: RunStylePatch): RangeStyle {
  const out: Record<string, unknown> = { ...range };
  const superseded = supersededKey(patch);
  if (superseded !== undefined) delete out[superseded];
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) out[key] = value;
  }
  return out as RangeStyle;
}

/** Apply `patch` to one run, deleting rather than storing "no override". */
function patchRun(run: StyledRun, patch: RunStylePatch): StyledRun {
  const next: StyledRun = { ...run };
  const superseded = supersededKey(patch);
  if (superseded !== undefined) delete next[superseded];
  for (const key of STYLE_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    // `false` is not a storable state — it means "no run-level override",
    // same as `undefined`. Deleting keeps one canonical form.
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
 * or `false` deletes the key instead of storing it.
 *
 * Returns a new array of new runs (though a nested `fill` is shared by
 * reference). Normalization — merging identical neighbors, dropping empty
 * runs — applies to the whole array, not just the patched span, and to every
 * call, including one whose range is empty.
 */
export function applyStyleToRange(
  runs: readonly StyledRun[],
  start: number,
  end: number,
  patch: RunStylePatch,
): StyledRun[] {
  const lo = Math.max(0, start);
  const hi = Math.min(totalLength(runs), end);
  if (!(lo < hi)) return coalesceRuns(runs);

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
