import type { Bounds, SnapMark, SnapSource } from '@weasel-js/core';
import {
  applyEdges, equalGaps, measureGapSpans, referenceGaps, spacingOffers, type MeasuredGap,
} from '../guides/alignment/spacing';
import type { SpacingGap } from '../guides/types';
import { axisLine, landedShift } from './lines';
import { cachedPerScene } from './targets';

type Point = { x: number; y: number };

/** Options for `spacingSnapSource`. */
export interface SpacingSnapSourceOptions {
  /** The boxes to measure gaps between, in place of the subject's siblings. */
  getTargets?: () => readonly Bounds[];
  /** The color of the gaps it marks. Default: the readout layer's. */
  color?: string;
  /** Overrides the canvas's reach for these targets, in screen px. */
  reachPx?: number;
}

interface Measured { boxes: readonly Bounds[]; x: readonly MeasuredGap[]; y: readonly MeasuredGap[] }

const measureAll = (boxes: readonly Bounds[]): Measured =>
  ({ boxes, x: measureGapSpans(boxes, 'x'), y: measureGapSpans(boxes, 'y') });

function gapMark(g: SpacingGap, color: string | undefined): SnapMark {
  const ends = g.axis === 'x'
    ? { from: { x: g.min, y: g.at }, to: { x: g.max, y: g.at } }
    : { from: { x: g.at, y: g.min }, to: { x: g.at, y: g.max } };
  return { kind: 'gap', ...ends, value: g.max - g.min, ...(color === undefined ? {} : { color }) };
}

const shifted = (b: Bounds, d: Point): Bounds => applyEdges(b, d.x, d.y, { x: 'both', y: 'both' });

/**
 * Equal spacing as snap targets, Figma's: on each axis, the positions of the
 * subject's box that make its gap to a neighbor equal one already between
 * two siblings, or center it between its two neighbors. When the result
 * meets one, it marks every gap of that size, the box's own included.
 */
export function spacingSnapSource(opts: SpacingSnapSourceOptions = {}): SnapSource {
  const fromScene = cachedPerScene(measureAll);
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
      for (const axis of ['x', 'y'] as const) {
        const refs = referenceGaps(box, measured[axis]);
        const seen = new Set<string>();
        for (const o of spacingOffers(box, axis, 'both', measured.boxes, refs)) {
          const key = `${o.delta.toFixed(6)}:${o.size.toFixed(6)}`;
          if (Math.abs(o.delta) > reach || seen.has(key)) continue;
          seen.add(key);
          yield {
            probe: probe.id,
            locus: axisLine(axis, probe.at[axis] + o.delta, probe.at),
            mark: (delta: Point) => {
              const landed = shifted(box, landedShift(q, delta));
              return equalGaps(landed, axis, o.size, measured.boxes, refs).map((g) => gapMark(g, opts.color));
            },
          };
        }
      }
    },
  };
}
