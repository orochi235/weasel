/**
 * What the layout and paint caches hold for one runs array, in one `WeakMap`
 * entry, so a runs array new every frame costs one set and one delete rather
 * than one in each cache.
 */
import type { ResolvedRun } from '../runs/resolveRuns';
import type { Structural, Variant } from './layoutCache';
import type { LaidOutRuns } from './layoutRuns';
import type { Painting } from './paintCache';

export interface RunsEntry {
  /** `faceGeneration()` when the layout cache filled `variants`; -1 until it has. */
  generation: number;
  /** The layout cache's layouts of these runs, most recently matched first. */
  variants: Variant[];
  /** The paint cache's own painting of these runs, the layout it was painted
   *  on, and the threshold it was last asked for at. The runs fix every paint,
   *  so the same layout at an unchanged threshold and glyph generation is a
   *  hit with no key built. */
  painting: Painting | null;
  paintedOn: LaidOutRuns | null;
  /** `paintedOn`'s columns' stamp when it was painted: a recycled layout's
   *  result is handed on, so the object alone does not say it is the same layout. */
  paintedStamp: number;
  paintMin: number | undefined;
  /** The structural entry these runs filled, which compares later runs with
   *  them: it is dead once they are refilled in place. */
  listed: Structural | null;
}

let entries = new WeakMap<readonly ResolvedRun[], RunsEntry>();

/** Entries `dropEntry` let go, for the next runs arrays. */
const spare: RunsEntry[] = [];
const SPARE_MAX = 1024;

export function entryOf(runs: readonly ResolvedRun[]): RunsEntry | undefined {
  return entries.get(runs);
}

/** `runs`' entry, filed now if it has none. */
export function entryFor(runs: readonly ResolvedRun[]): RunsEntry {
  let e = entries.get(runs);
  if (e === undefined) {
    e = spare.pop() ?? {
      generation: -1, variants: [], painting: null, paintedOn: null, paintedStamp: 0, paintMin: undefined,
      listed: null,
    };
    entries.set(runs, e);
  }
  return e;
}

/** Unfile `runs`' entry and return it, for the caller to empty and pass to
 *  {@link giveEntry}. */
export function dropEntry(runs: readonly ResolvedRun[]): RunsEntry | undefined {
  const e = entries.get(runs);
  if (e !== undefined) entries.delete(runs);
  return e;
}

/** Reset an entry whose `variants` the caller has emptied, leaving it filed. */
export function emptyEntry(e: RunsEntry): void {
  e.generation = -1;
  e.painting = null;
  e.paintedOn = null;
  e.paintMin = undefined;
  e.listed = null;
}

/** Take back an entry whose `variants` the caller has emptied. */
export function giveEntry(e: RunsEntry): void {
  emptyEntry(e);
  if (spare.length < SPARE_MAX) spare.push(e);
}

/** Test helper. Do not call from product code. */
export function _resetRunsEntriesForTests(): void {
  entries = new WeakMap();
}
