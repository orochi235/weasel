/**
 * Line jumps for a data-backed diagram: the specs `diagramScene` builds, with
 * each edge carrying the hops it makes over the edges before it. The hops
 * derive from the specs, so they live there and are never reported back.
 */
import type { RectPose } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { edgeRouter } from '../edge';
import { diagramEdgeOf } from '../edgeTrait';
import type { DiagramSpec } from '../fromData';
import { edgeHops } from './crossings';
import { withHopsData } from './sceneEdges';
import { specDeps, specWorldPoses } from '../specWorld';

/** A function from specs to the same specs with every edge's hops of radius
 *  `r`, edges hopping those earlier in the list. An edge split across pages
 *  takes no part. */
export function createSpecHops(r: number): (specs: readonly DiagramSpec[]) => DiagramSpec[] {
  const route = edgeRouter<RectPose>();
  return (specs) => {
    const dep = specDeps(specs, specWorldPoses(specs));
    const polylines = new Map<string, Vec2[]>();
    const order: string[] = [];
    for (const spec of specs) {
      const ends = spec.dependsOn;
      if (diagramEdgeOf(spec) === null || !Array.isArray(ends) || ends.length !== 2) continue;
      const routed = route(spec, [dep(ends[0]), dep(ends[1])]);
      const points = routed?.stubs === undefined ? routed?.points : undefined;
      if (points === undefined || points.length < 2) continue;
      polylines.set(spec.id as string, [...points]);
      order.push(spec.id as string);
    }
    const hops = edgeHops(polylines, order, r);
    return specs.map((spec) => {
      const trait = diagramEdgeOf(spec);
      const list = hops.get(spec.id as string) ?? [];
      if (trait === null || (list.length === 0 && trait.hops === undefined)) return spec;
      return { ...spec, data: withHopsData(spec.data, trait, list) as DiagramSpec['data'] };
    });
  };
}
