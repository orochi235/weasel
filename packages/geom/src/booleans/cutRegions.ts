/** Grouping traced loops into regions, and writing contours back out as paths. */

import { pointInPolygon } from '../polyline';
import type { PolygonPath, PathFillRule } from '../path';
import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z } from '../commands';
import { type Contour, evalSeg, sampleContour, signedArea } from './contourSegments';
import type { Subpath } from './contours';
import { coordsFrom, originFor } from '../paths/pathOrigin';

/** Group loops into regions: each positive loop with the holes it immediately contains. */
export function assembleRegions(outers: Contour[], holes: Contour[]): Contour[][] {
  const regions = outers.map((o) => ({ loops: [o], ring: sampleContour(o), area: signedArea(o) }));
  for (const h of holes) {
    const hp = evalSeg(h[0], 0.5);
    let best: (typeof regions)[number] | null = null;
    for (const r of regions) {
      if (pointInPolygon(r.ring, hp.x, hp.y) && (!best || r.area < best.area)) best = r;
    }
    best?.loops.push(h);
  }
  return regions.map((r) => r.loops);
}

export const regionArea = (r: Contour[]): number => r.reduce((s, c) => s + signedArea(c), 0);

export const toPath = (loops: Contour[], fillRule: PathFillRule): PolygonPath =>
  writePath(loops.map((segs) => ({ segs, closed: true })), fillRule);

export function writePath(subpaths: Subpath[], fillRule: PathFillRule): PolygonPath {
  const cmds: number[] = [];
  const xs: number[] = [];
  for (const { segs, closed } of subpaths) {
    cmds.push(PATH_M);
    xs.push(segs[0][0].x, segs[0][0].y);
    for (const s of segs) {
      cmds.push(s.length === 2 ? PATH_L : s.length === 3 ? PATH_Q : PATH_C);
      for (let i = 1; i < s.length; i++) xs.push(s[i].x, s[i].y);
    }
    if (closed) cmds.push(PATH_Z);
  }
  const origin = originFor(xs);
  return {
    kind: 'polygon', commands: new Uint8Array(cmds), coords: coordsFrom(origin, xs), fillRule, ...(origin ? { origin } : {}),
  };
}
