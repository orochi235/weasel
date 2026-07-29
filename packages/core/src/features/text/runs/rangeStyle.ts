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
 * Offsets are UTF-16 code units, as everywhere else in this feature, so a
 * boundary can bisect a surrogate pair (`[1, 2)` over `'a👍b'` splits the
 * thumbs-up into lone surrogates). A caret-derived range never does this.
 *
 * **Run-level flags are additive over the node's `TextStyle`: a run can
 * turn `bold` / `italic` / `underline` / `strikethrough` on, never off.**
 * So a flag is stored only when true, and absent reads as `false`. For
 * `bold` this falls out of the model — node weight is numeric, and
 * `run.bold ? 700 : baseWeight` has nowhere to put "not bold." For the
 * boolean decorations it does not: both levels are booleans, so a tri-state
 * (`true` / `false` / inherit) is expressible and we are collapsing it by
 * choice, to keep one canonical form per styling. Resolution must therefore
 * read decorations as `run.underline || style.underline` — a `??` would
 * make "select a word in an underlined node, hit U to turn it off" look
 * supported by the type while this file discards the `false` that expresses it.
 *
 * Copies here are shallow: a `fill` object is shared by reference between
 * the input runs, the patch, every run the patch touched, and the value
 * `styleAtRange` reports. Treat `fill` values as immutable.
 */

import { MIXED } from 'core/mixed';
import type { Mixed } from 'core/mixed';
import type { StyledRun } from '../runs';

export { MIXED };
export type { Mixed };

/** Every styleable key of a run, each either a concrete value or MIXED (the
 *  runs in the range disagree at that key). */
export type RangeStyle = {
  [K in Exclude<keyof StyledRun, 'text'>]?: StyledRun[K] | Mixed;
};

/**
 * What `applyStyleToRange` writes. `text` is deliberately not part of it —
 * this is a styling operation, not an edit.
 */
export type RunStylePatch = Partial<Omit<StyledRun, 'text'>>;

/** Every key of a run that carries styling — i.e. everything but `text`. */
export type StyleKey = Exclude<keyof StyledRun, 'text'>;

const STYLE_KEYS = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'fontFamily',
  'fontSize',
  'letterSpacing',
  'fill',
] as const satisfies readonly StyleKey[];

// Every function here iterates STYLE_KEYS, so a key missing from the list is
// invisible: `applyStyleToRange` would drop it when patching a run and
// `sameStyle` would merge two runs that differ in it, silently discarding
// one value. `satisfies` only checks the entries that ARE listed, so this
// assertion checks the other direction — adding a key to `StyledRun`
// without adding it here is a compile error.
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
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Structural equality over the JSON-ish values a run can hold. This assumes
 * `FillStyle` stays acyclic and plain — every member of the union is data
 * (`TextureHandle` is `{ id }`, so patterns compare by id, which is right).
 * A fill that grew a cyclic or class-valued field would recurse forever.
 */
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
 * value where the range agrees, `MIXED` where it doesn't. Keys no run
 * in range sets are absent (they inherit the node's `TextStyle`) — except
 * the additive flags, which read as `false` rather than `undefined` since a
 * run cannot un-set them. An empty range reads as `{}`. A reported `fill`
 * is the run's own object, not a copy — treat it as immutable.
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

/** Apply `patch` to one run, deleting rather than storing "no override". */
function patchRun(run: StyledRun, patch: RunStylePatch): StyledRun {
  const next: StyledRun = { ...run };
  for (const key of STYLE_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    // Per the additive-flags contract at the top of the file, `false` is not
    // a storable state — it means "no run-level override", same as
    // `undefined`. Deleting keeps one canonical form (coalescing already
    // treats absent and `false` as equal, so this isn't what makes runs
    // merge — it's what keeps the stored shape from drifting).
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
 * or `false` deletes the key instead of storing it — see the additive-flags
 * contract at the top of the file.
 *
 * Returns a new array of new runs; neither the input array nor its runs are
 * mutated (though a nested `fill` is shared by reference). Normalization —
 * merging identical neighbors, dropping empty runs — applies to the whole
 * array, not just the patched span, and to every call, including one whose
 * range is empty and so patches nothing.
 */
export function applyStyleToRange(
  runs: readonly StyledRun[],
  start: number,
  end: number,
  patch: RunStylePatch,
): StyledRun[] {
  const lo = Math.max(0, start);
  const hi = Math.min(totalLength(runs), end);
  // A collapsed caret is the common call, so it takes the same normalization
  // as any other range rather than a laxer copy-only path.
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
