/**
 * A path effect's source, as the effect reads it: the outline its node is
 * drawn with, and the fill and stroke that outline is painted in. Both belong
 * to the node's painter, so the reader is handed to
 * `createPathEffectDerivations` by the layer that owns the painters.
 */
import type { Path } from '@weasel-js/geom';
import type { Fill, Stroke } from '@weasel-js/paint';
import type { DerivedPart } from '../derivedParts';
import type { DerivedDep } from '../types';

/** Options every path effect may take. */
export interface PathEffectOptions {
  /** Its sources are hidden while it shows them. */
  hideSources?: boolean;
  /**
   * With `hideSources`, the positions in its sources of those already hidden
   * when it was made: it leaves them hidden when it goes, and takes none of
   * them with it. Absent, it hid them all. `scene.setDependsOn` moves it
   * with the sources it names.
   */
  foundHidden?: readonly number[];
}

/** One rigid piece an effect lays along a path, in its own frame: x from 0 at its leading edge to `length`, y down,
 *  its anchor line (a glyph's baseline) at y = 0. */
export interface EffectItem {
  /** How much of the path it takes. */
  length: number;
  /** Height above the anchor line of the line it centers on — a glyph's x-height middle. */
  middle: number;
  /** What it paints; empty for a piece that only takes room, such as a space. */
  parts: readonly DerivedPart[];
}

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
  /** The pieces it lays one by one along a path — a text node's grapheme
   *  clusters. Called only by an effect that lays items. */
  items?: () => readonly EffectItem[];
}

/** Reads one dependency as a source; `null` when it has no outline. */
export type EffectSourceReader = (dep: DerivedDep<unknown>) => EffectSource | null;
