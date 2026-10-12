/**
 * The paint-kind registry — what makes `Paint` open.
 *
 * A consumer registers a sixth kind and it renders, converts between the
 * bounds and pose frames, and serializes, with no kit edits. The five built-in
 * kinds are registered here at module load so an editor's kind bar can
 * enumerate every kind through one list.
 *
 * Every entry is also handed to the renderer's own registry, which reads only
 * its draw slots. A built-in kind has none: its render slot is a branch in the
 * GL renderer and its serialize slot lives in `@weasel-js/svg`.
 */

import type {
  ColorSpace, Paint, GradientFill, GradientKind, GradStop, TilePatternSpec,
} from '@weasel-js/paint';
import { gradientForBounds, isGradientFill, withGradientKind } from '@weasel-js/paint';
import { createReflectable, type ReflectedEntry, type Reflection } from '@weasel-js/registry';
import { getPaintDrawKind, registerPaintDrawKind, registerPaintDrawKindLoader } from '@weasel-js/renderer';
import { _resetPaintDrawKindsForTests } from '@weasel-js/renderer/test-seams';
import type { PaintKind, PaintKindEntry } from './paintKindEntry';

const BUILTINS: readonly PaintKindEntry[] = [
  {
    id: 'solid',
    label: 'Solid',
    icon: 'paintSolid',
    seed: (color) => ({ color }),
    colorOf: (paint) => ((paint.fill ?? 'solid') === 'solid'
      ? (paint as { color: string }).color
      : undefined),
  },
  gradientKind('linear-gradient', 'Linear', 'paintLinear'),
  gradientKind('radial-gradient', 'Radial', 'paintRadial'),
  gradientKind('conic-gradient', 'Conic', 'paintConic'),
  {
    id: 'pattern',
    label: 'Pattern',
    icon: 'paintPattern',
    seed: (color) => ({
      fill: 'pattern',
      pattern: { tile: 'hatch', color },
      units: 'bounds',
    }),
    colorOf: (paint) => (paint.fill === 'pattern'
      ? (paint.pattern as Partial<TilePatternSpec>).color
      : undefined),
  },
];

function gradientKind(id: GradientKind, label: string, icon: string): PaintKindEntry {
  return {
    id,
    label,
    icon,
    // `bounds` units make the seed independent of the node's actual size.
    seed: (color) => gradientForBounds(id, UNIT_BOX, twoStopRamp(color), 'bounds'),
    colorOf: (paint) => (paint as Partial<GradientFill>).stops?.[0]?.color,
    stopsOf: (paint) => (paint as GradientFill).stops,
    fromStops: (stops) => gradientForBounds(id, UNIT_BOX, stops, 'bounds'),
  };
}

const UNIT_BOX = { x: 0, y: 0, width: 1, height: 1 };

/** `color` to a contrasting end — white reads against any hue; against white
 *  itself, black does. */
function twoStopRamp(color: string): GradStop[] {
  const isWhite = color.slice(0, 7).toLowerCase() === '#ffffff';
  return [{ offset: 0, color }, { offset: 1, color: isWhite ? '#000000ff' : '#ffffffff' }];
}

const KINDS = createReflectable<PaintKindEntry>();

/** Resolves with the entry for a kind that is loaded on first use. */
export type PaintKindLoader = () => Promise<PaintKindEntry>;

// A built-in kind heavy enough to keep off a consumer's bundle until a paint
// of it turns up. Importing the module statically still registers it at once.
const LAZY_BUILTINS: ReadonlyArray<readonly [string, PaintKindLoader]> = [
  ['mesh-gradient', async () => (await import('./meshKindLazy')).meshGradientKind],
];

function seed(): void {
  for (const entry of BUILTINS) {
    KINDS.push(entry.id, entry, { source: 'kit' });
    registerPaintDrawKind(entry);
  }
  for (const [id, load] of LAZY_BUILTINS) registerPaintKindLoader(id, load);
}
seed();

/** Every registered paint kind, with the overrides each displaced. */
export const paintKindRegistry: Reflection<PaintKindEntry> = KINDS.reflection;

/** Register a paint kind. Returns a disposer that removes it. Re-registering an
 *  existing id is an override; disposing it uncovers whatever it displaced. */
export function registerPaintKind(entry: PaintKindEntry): () => void {
  if ((entry.stopsOf === undefined) !== (entry.fromStops === undefined)) {
    const missing = entry.stopsOf === undefined ? 'stopsOf' : 'fromStops';
    throw new Error(
      `weasel registerPaintKind: kind "${entry.id}" is missing ${missing}. A ` +
      'gradient kind reads as a stop list and builds from one; supply both or neither.',
    );
  }
  // The draw half goes first: it is the one that can throw, and the editor's
  // list fires its subscribers on push.
  const dropDraw = registerPaintDrawKind(entry);
  const dropEntry = KINDS.push(entry.id, entry);
  return () => {
    dropEntry();
    dropDraw();
  };
}

/**
 * Declare a paint kind that is loaded the first time something looks it up,
 * so its code stays out of the bundle until a paint of it appears — typically
 * `() => import('./myKind').then((m) => m.myKindEntry)`.
 *
 * Until it lands the kind is unregistered: the renderer draws nothing for its
 * paints, and every other reader treats it as unknown. Registering it fires
 * `paintKindRegistry`'s subscribers, which is what `<SceneCanvas>` repaints
 * on. Call `warmPaintKinds` to load ahead of the first frame instead — with no
 * list it loads the kit's lazily loaded built-ins (`mesh-gradient`) plus any
 * declared here.
 *
 * A kind that is already registered never calls its loader. Returns a
 * disposer that removes the loader.
 */
export function registerPaintKindLoader(id: string, load: PaintKindLoader): () => void {
  return registerPaintDrawKindLoader(id, async () => {
    const entry = await load();
    if (entry.id === id && !KINDS.has(id)) registerPaintKind(entry);
    return entry;
  });
}

/** The entry for `kind`, or `undefined`. A lookup that misses on a kind with
 *  a loader starts that load; see {@link registerPaintKindLoader}. */
export function getPaintKind(kind: string | undefined): PaintKindEntry | undefined {
  const id = kind ?? 'solid';
  const entry = KINDS.get(id);
  if (!entry) getPaintDrawKind(id);
  return entry;
}

/** A list derived from the registry, recomputed only when it changes — so
 *  its identity is a `useSyncExternalStore` snapshot. */
function derivedList(
  derive: (all: readonly ReflectedEntry<PaintKindEntry>[]) => readonly PaintKindEntry[],
): () => readonly PaintKindEntry[] {
  let from: readonly ReflectedEntry<PaintKindEntry>[] | undefined;
  let list: readonly PaintKindEntry[] = [];
  return () => {
    const entries = KINDS.entries();
    if (entries !== from) {
      from = entries;
      list = Object.freeze(derive(entries));
    }
    return list;
  };
}

/** Every registered kind, built-ins first, in registration order. The same
 *  array until the registry changes. */
export function listPaintKinds(): readonly PaintKindEntry[] {
  return allKinds();
}
const allKinds = derivedList((all) => all.map((e) => e.value));

/** Every registered gradient kind — the ones that read as and build from a
 *  stop list — in registration order. The same array until the registry
 *  changes. */
export function listGradientKinds(): readonly PaintKindEntry[] {
  return gradientKinds();
}
const gradientKinds = derivedList(
  (all) => all.map((e) => e.value).filter((entry) => entry.stopsOf && entry.fromStops),
);

/**
 * `paint` retargeted to gradient kind `kind`, or `undefined` when either side
 * is not a gradient kind.
 *
 * Between two of the stop gradients this is `withGradientKind`, which carries
 * the geometry. Any other pair goes through the stop list — `stopsOf` on the
 * way out, `fromStops` on the way in — keeping `interpolate` and `opacity`.
 * Lossy wherever the kinds hold different information; an editor that wants a
 * switch to be undoable should keep the original paint.
 */
export function switchGradientKind(paint: Paint, kind: PaintKind): Paint | undefined {
  const from = paintKindOf(paint);
  const to = getPaintKind(kind);
  if (!from?.stopsOf || !to?.fromStops) return undefined;
  if (from.id === to.id) return paint;
  if (isGradientFill(paint) && isGradientFill({ fill: kind } as Paint)) {
    return withGradientKind(paint, kind as GradientKind);
  }
  const { interpolate, opacity } = paint as { interpolate?: ColorSpace; opacity?: number };
  return {
    ...to.fromStops(from.stopsOf(paint)),
    ...(interpolate !== undefined ? { interpolate } : {}),
    ...(opacity !== undefined ? { opacity } : {}),
  } as Paint;
}

/** The registry entry for a paint, or `undefined` when its kind is unknown. */
export function paintKindOf(fill: Paint): PaintKindEntry | undefined {
  return getPaintKind(fill.fill ?? 'solid');
}

/** @internal Test helper — do not call from product code. */
export function _resetPaintKindsForTests(): void {
  KINDS.clear();
  _resetPaintDrawKindsForTests();
  seed();
}
