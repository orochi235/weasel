import { asNodeId, sceneMagnification, type Bounds, type SnapCollect, type SnapMark, type SnapSource } from '@weasel-js/core';
import {
  equalGaps, measureGapSpans, referenceGaps, spacingOffers, type MeasuredGap,
} from '../guides/alignment/spacing';
import type { SpacingEdge } from '../guides/alignment/types';
import type { SpacingGap } from '../guides/types';
import { landedBox, sideLine } from './lines';
import { cachedPerScene, type TargetFilter } from './targets';

type Point = { x: number; y: number };

/** A side of the box the gesture moves on `axis`, at `rate` per unit of the move. */
interface Moving { axis: 'x' | 'y'; edge: SpacingEdge; rate: Point }

const TRANSLATE: readonly Moving[] = [
  { axis: 'x', edge: 'both', rate: { x: 1, y: 0 } },
  { axis: 'y', edge: 'both', rate: { x: 0, y: 1 } },
];

/** A move's whole box on each axis, else the sides a resize moves. */
function movingSides(q: SnapCollect): readonly Moving[] {
  return q.sides ? q.sides.map((s) => ({ axis: s.axis, edge: s.side, rate: s.rate })) : TRANSLATE;
}

/** Options for `spacingSnapSource`. */
export interface SpacingSnapSourceOptions {
  /** The boxes to measure gaps between, in place of the subject's siblings. */
  getTargets?: () => readonly Bounds[];
  /** Which nodes offer gaps. Narrows the default siblings; not `getTargets`. */
  filter?: TargetFilter;
  /** The color of the gaps it marks. Default: the readout layer's. */
  color?: string;
  /** Overrides the canvas's reach for these targets, in screen px. */
  reachPx?: number;
}

interface Measured { boxes: readonly Bounds[]; x: readonly MeasuredGap[]; y: readonly MeasuredGap[] }

const measureAll = (boxes: readonly Bounds[]): Measured =>
  ({ boxes, x: measureGapSpans(boxes, 'x'), y: measureGapSpans(boxes, 'y') });

function gapMark(g: SpacingGap, color: string | undefined, magnification: number): SnapMark {
  const ends = g.axis === 'x'
    ? { from: { x: g.min, y: g.at }, to: { x: g.max, y: g.at } }
    : { from: { x: g.at, y: g.min }, to: { x: g.at, y: g.max } };
  return { kind: 'gap', ...ends, value: (g.max - g.min) / magnification, ...(color === undefined ? {} : { color }) };
}

/**
 * Equal spacing as snap targets, Figma's: on each axis, the positions of the
 * subject's box that make its gap to a neighbor equal one already between
 * two siblings, or center it between its two neighbors. A resize moves only
 * the sides it drags; on a turned or skewed box, the sides of its
 * axis-aligned extent the drag moves. When the result meets one, it marks
 * every gap of that size, the box's own included, where the box lands.
 */
export function spacingSnapSource(opts: SpacingSnapSourceOptions = {}): SnapSource {
  const fromScene = cachedPerScene(measureAll, opts.filter);
  return {
    id: 'spacing',
    ...(opts.reachPx === undefined ? {} : { reachPx: opts.reachPx }),
    roles: ['box'],
    gestures: ['move', 'resize'],
    *collect(q) {
      const box = q.box;
      const probe = q.probes.find((p) => p.role === 'box');
      const measured = opts.getTargets ? measureAll(opts.getTargets()) : fromScene(q);
      if (!box || !probe || !measured) return;
      const reach = q.reachWorld(q.reachPx);
      const refs = { x: referenceGaps(box, measured.x), y: referenceGaps(box, measured.y) };
      const seen = new Set<string>();
      const magnification = q.scene && q.ids?.length ? sceneMagnification(q.scene, q.ids.map(asNodeId)) : 1;
      for (const { axis, edge, rate } of movingSides(q)) {
        const speed = Math.hypot(rate.x, rate.y);
        for (const o of spacingOffers(box, axis, edge, measured.boxes, refs[axis])) {
          const key = `${axis}:${edge}:${o.delta.toFixed(6)}:${o.size.toFixed(6)}`;
          if (Math.abs(o.delta) / speed > reach || seen.has(key)) continue;
          seen.add(key);
          yield {
            probe: probe.id,
            locus: sideLine(probe.at, rate, o.delta),
            mark: (delta: Point) => {
              const landed = landedBox(q, delta) ?? box;
              return equalGaps(landed, axis, o.size, measured.boxes, refs[axis]).map((g) => gapMark(g, opts.color, magnification));
            },
          };
        }
      }
    },
  };
}
