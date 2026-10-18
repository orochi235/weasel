import type { SnapSource } from '@weasel-js/core';
import type { Guide } from '../guides/types';
import { axisLine } from './lines';

/**
 * Ruler guides as snap targets: each guide within reach of an origin or
 * pointer probe is a line it may land on. Reads `getGuides` every frame, so
 * a guide added mid-drag counts at once.
 */
export function guideSnapSource(getGuides: () => readonly Guide[]): SnapSource {
  return {
    id: 'guides',
    roles: ['origin', 'pointer'],
    *collect(q) {
      const guides = getGuides();
      if (guides.length === 0) return;
      const reach = q.reachWorld(q.reachPx);
      for (const p of q.probes) {
        for (const g of guides) {
          if (Math.abs(p.at[g.axis] - g.offset) > reach) continue;
          yield { probe: p.id, locus: axisLine(g.axis, g.offset, p.at) };
        }
      }
    },
  };
}
