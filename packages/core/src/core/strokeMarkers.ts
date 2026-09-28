/**
 * The stroke-marker registry — arrowheads and other line terminators.
 *
 * Keyed by string, because a key is what sits in `stroke.markerEnd`. That is
 * the difference from `registerNodeShape`, which resolves by first-matching
 * predicate and whose `id` is only a label.
 *
 * A built-in's SVG slot lives in `@weasel-js/svg` and cannot be imported here
 * without inverting a package dependency, so an entry carries `toSvg` for that
 * package to consume — the same split `PaintKindEntry` uses.
 */

import type { FillStyle, MarkerKey, Stroke } from '@weasel-js/paint';
import type { Path } from './geometry/path';
import { createReflectable, type Reflection } from '@weasel-js/registry';
import { BUILTIN_MARKERS } from './strokeMarkerShapes';

/** What an entry's `path` is given. Entries that ignore it may return a
 *  constant path. */
export interface MarkerCtx {
  /** One geometry unit, in the same world units the ribbon is tessellated in.
   *  Defaults to the resolved stroke width. */
  readonly size: number;
  /** The stroke this marker belongs to, already width-resolved. */
  readonly stroke: Stroke;
}

/** `'line'` means the stroke's own paint — SVG 2's `context-stroke`, as the
 *  default rather than an opt-in. */
export type MarkerPaint = FillStyle | 'line' | 'none';

export interface MarkerEntry {
  /** `'kit:'`-free for built-ins so the key matches the SVG attribute value;
   *  consumers should prefix (`'app-my-head'`). A key becomes the `id` of the
   *  emitted `<marker>` def, so it must be a valid XML name — no colons. */
  id: MarkerKey;
  /** Geometry with its anchor at the origin, pointing +X, in units of
   *  `ctx.size`. An arbitrary anchor is expressed by where the geometry is
   *  drawn, which is why there is no `refX`/`refY`. */
  path(ctx: MarkerCtx): Path;
  /** Default `'line'`. */
  fill?: MarkerPaint;
  /** Outline width is in the same units as `path`. `false` (the default)
   *  means no outline. */
  outline?: { width: number; paint?: MarkerPaint } | false;
  /** How far back along the line the stroke stops, in units of `ctx.size`.
   *  Default 0. A property of the shape, not a setting on the stroke: an open
   *  V needs 0 or its arms stop meeting the line. */
  inset?: number;
  /** `'auto'` (default) follows the line; a number is a fixed angle in
   *  radians, ignoring the line — SVG's `orient="<angle>"`. */
  orient?: 'auto' | number;
  /** The stroke fields `path` reads besides `ctx.size` — `[]` for a shape
   *  drawn from size alone. Declared, a head is reused across stroke objects
   *  whose listed fields are equal; omitted, only across frames that pass the
   *  same stroke object, since `path` might read any of it. */
  reads?: readonly (keyof Stroke)[];
  /** Emits the `<marker>` def. Consumed by `@weasel-js/svg`. */
  toSvg?(id: string, entry: MarkerEntry): string;
}

const MARKERS = createReflectable<MarkerEntry>();

function seedBuiltins(): void {
  for (const entry of BUILTIN_MARKERS) MARKERS.push(entry.id, entry, { source: 'kit' });
}
seedBuiltins();

/** Every registered marker, with the overrides each displaced. */
export const markerRegistry: Reflection<MarkerEntry> = MARKERS.reflection;

/** Bumped whenever the registered set changes, for caches of marker geometry. */
export function markerGeneration(): number {
  return MARKERS.getVersion();
}

/** Register a marker. Returns a disposer. Re-registering an existing id is an
 *  override; disposing it uncovers whatever it displaced rather than deleting the key. */
export function registerMarker(entry: MarkerEntry): () => void {
  return MARKERS.push(entry.id, entry);
}

/** The entry for `key`, or `undefined`. */
export function getMarker(key: string | undefined): MarkerEntry | undefined {
  return key === undefined ? undefined : MARKERS.get(key);
}

/** Every registered marker, built-ins first, in registration order. */
export function listMarkers(): readonly MarkerEntry[] {
  return MARKERS.entries().map((e) => e.value);
}

/** Test helper. Do not call from product code. */
export function _resetMarkersForTests(): void {
  MARKERS.clear();
  seedBuiltins();
}
