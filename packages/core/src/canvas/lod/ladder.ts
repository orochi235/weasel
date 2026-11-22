/** A node's representations by on-screen size, and the rule that picks one with hysteresis. */
import type { DrawCommand } from '@weasel-js/renderer';
import type { Node } from 'core/scene/types';
import type { NodePaintCtx } from '../nodeShapeTypes';

import type { NodeLod, RungId } from 'core/scene/nodeLod';

export type { NodeLod, RungId };

/** The rungs every node has. `full` is the painter's own paint; `box` fills the node's pose box and
 *  `none` draws nothing, and both draw in place of the node's children, which are not visited. */
export const BUILT_IN_RUNGS = ['full', 'box', 'none'] as const;

/** One representation in a {@link Ladder}. */
export interface Rung<TData = unknown, TPose = unknown> {
  id: RungId;
  /** Shown while the node measures at least this many device pixels, up to the next rung's. */
  fromPx: number;
  /** What it draws. Absent: the painter's own `paint`. */
  paint?(node: Node<TData, string, TPose>, pose: TPose, ctx?: NodePaintCtx): DrawCommand[];
  /** `'skip'` draws this rung in place of the node's children, which the walk does not visit.
   *  Default `'walk'`. */
  children?: 'walk' | 'skip';
}

/** How far past a threshold the on-screen size must go before the rung changes. */
export interface LodHysteresis {
  /** Moving up to a rung waits for `fromPx × up`. */
  up: number;
  /** Moving down off a rung waits for `fromPx × down`. */
  down: number;
}

export const DEFAULT_HYSTERESIS: LodHysteresis = { up: 1.5, down: 0.67 };

/** A kind's representations, coarse to fine. */
export interface Ladder<TData = unknown, TPose = unknown> {
  /** Ascending `fromPx`; the first is shown from 0 whatever it says. */
  rungs: readonly Rung<TData, TPose>[];
  /** The world length measured against `fromPx`. Default: the longest side of the pose box.
   *  `Infinity` keeps the finest rung, as for text sized in screen pixels. */
  sizeOf?(node: Node<TData, string, TPose>, pose: TPose): number;
  /** Default {@link DEFAULT_HYSTERESIS}. */
  hysteresis?: LodHysteresis;
}

/**
 * The index of the rung a node shows at `sizePx` device pixels, given the rung it showed last
 * (`prev`, or -1 for none). `from` holds each rung's `fromPx`, ascending.
 *
 * From rung *i* it climbs to *j* once the size reaches `from[j] × up`, and drops once the size falls
 * below `from[i] × down`, leaving a dead band around each threshold so a zoom parked on one does not
 * flicker. With no previous rung it takes the highest rung the size reaches.
 */
export function rungIndexAt(
  from: readonly number[],
  sizePx: number,
  prev: number,
  h: LodHysteresis = DEFAULT_HYSTERESIS,
): number {
  const n = from.length;
  if (prev < 0 || prev >= n) {
    let i = 0;
    while (i + 1 < n && sizePx >= from[i + 1]!) i++;
    return i;
  }
  let i = prev;
  while (i + 1 < n && sizePx >= from[i + 1]! * h.up) i++;
  if (i === prev) while (i > 0 && sizePx < from[i]! * h.down) i--;
  return i;
}
