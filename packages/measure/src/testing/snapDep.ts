/** Snap sources and a `snap` dep for this package's tests, built on core's test seam. */
import type { Point } from '@weasel-js/geom';
import type { AnyScene, SnapDep, SnapSource } from '@weasel-js/core';
import { createSnapSession2dForTests } from '@weasel-js/core/test-seams';

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/** Grid lines every `step` on both axes, for origin and pointer probes. */
export function gridSource(step: number): SnapSource {
  return {
    id: 'grid', tier: 'fallback', reachPx: Infinity, roles: ['origin', 'pointer'],
    *collect(q) {
      for (const p of q.probes) {
        yield { probe: p.id, locus: { at: { x: Math.round(p.at.x / step) * step, y: p.at.y }, dirs: [{ x: 0, y: 1 }] } };
        yield { probe: p.id, locus: { at: { x: p.at.x, y: Math.round(p.at.y / step) * step }, dirs: [{ x: 1, y: 0 }] } };
      }
    },
  };
}

/** One line through `at` along `dir`, for pointer probes: a ruler guide. */
export function lineSource(at: Point, dir: Point): SnapSource {
  return {
    id: `line:${at.x},${at.y}`, roles: ['pointer'],
    *collect(q) {
      for (const p of q.probes) yield { probe: p.id, locus: { at, dirs: [dir] } };
    },
  };
}

/** A `snap` dep whose sessions run `sources` over `scene` at zoom 1, with an 8px reach. */
export function sessionDep(scene: AnyScene, sources: readonly SnapSource[]): SnapDep {
  return {
    begin: ({ plane: _plane, along: _along, ...req }) => createSnapSession2dForTests({ ...req, scene, sources, view: VIEW, reachPx: 8 }),
  };
}
