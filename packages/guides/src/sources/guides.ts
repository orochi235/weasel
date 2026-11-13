import type { SnapSource } from '@weasel-js/core';
import type { Guide } from '../guides/types';
import { guideOffsetOn } from '../strategies/onPlane';
import { axisLine } from './lines';

/** Options for `guideSnapSource`. */
export interface GuideSnapSourceOptions {
  /** The guides, read every frame. */
  getGuides: () => readonly Guide[];
  /** The source's id, so two of them can snap on one canvas. Default `'guides'`. */
  id?: string;
  /** Overrides the canvas's reach for these targets, in screen px. */
  reachPx?: number;
}

/**
 * Ruler guides as snap targets: each guide within reach of a box or
 * pointer probe is a line it may land on: a moved box's edges and center,
 * stroke included. Reads `getGuides` every frame, so
 * a guide added mid-drag counts at once. A guide whose id the gesture
 * excludes offers nothing: the one a drag is moving.
 */
export function guideSnapSource(opts: GuideSnapSourceOptions): SnapSource {
  const { getGuides } = opts;
  return {
    id: opts.id ?? 'guides',
    ...(opts.reachPx === undefined ? {} : { reachPx: opts.reachPx }),
    roles: ['box', 'pointer'],
    *collect(q) {
      const guides = getGuides();
      if (guides.length === 0) return;
      const reach = q.reachWorld(q.reachPx);
      for (const p of q.probes) {
        for (const g of guides) {
          if (q.exclude.includes(g.id)) continue;
          const offset = guideOffsetOn(g, q.plane ?? null);
          if (Math.abs(p.at[g.axis] - offset) > reach) continue;
          yield { probe: p.id, locus: axisLine(g.axis, offset, p.at) };
        }
      }
    },
  };
}
