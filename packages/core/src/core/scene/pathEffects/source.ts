/**
 * A path effect's source, as the effect reads it: the outline its node is
 * drawn with, and the fill and stroke that outline is painted in.
 *
 * Both answers belong to the node's painter, which lives above the scene, so
 * the canvas layer installs the reader that asks it (`installEffectSourceReader`
 * from `canvas/nodeShapes/effectSource.ts`, run when the painter registry
 * loads). Until then a source is read only from a path some other reader
 * already resolved for it — a drag's override or its own derivation.
 */
import type { Path } from '@weasel-js/geom';
import type { Fill, Stroke } from '@weasel-js/paint';
import type { DerivedDep } from '../types';

/** A source shape. */
export interface EffectSource {
  /** Its outline where it is drawn. */
  world: Path;
  /**
   * The same outline before its pose turns it, with the turn: what lets a
   * blend interpolate rotation as a rotation rather than squash a turned
   * shape through its neighbors. Absent where the outline comes from
   * somewhere other than the pose — a drag's override, a derivation — or the
   * pose holds a skew a turn cannot say.
   */
  framed?: { path: Path; cx: number; cy: number; rotation: number };
  /** The paint it shows, resolved as its painter resolves it, so `null` is
   *  a real "none". */
  fill: Fill | null;
  stroke: Stroke | null;
}

/** Reads one dependency as a source; `null` when it has no outline. */
export type EffectSourceReader = (dep: DerivedDep<unknown>) => EffectSource | null;

const fromShownPath: EffectSourceReader = (dep) => {
  const shown = dep.path;
  if (shown === null) return null;
  const data = (dep.node.data ?? {}) as { fill?: Fill | null; stroke?: Stroke | null };
  return { world: shown, fill: data.fill ?? null, stroke: data.stroke ?? null };
};

let reader: EffectSourceReader = fromShownPath;

/** Make `read` the way every path effect reads its sources. */
export function installEffectSourceReader(read: EffectSourceReader): void {
  reader = read;
}

/** `dep` as a source, or `null` when it is gone or has no outline. */
export function effectSourceOf(dep: DerivedDep<unknown> | undefined): EffectSource | null {
  return dep === undefined ? null : reader(dep);
}
