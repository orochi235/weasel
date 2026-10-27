/**
 * Label placement for a data-backed diagram: the specs `diagramScene` builds,
 * with each edge label moved off whatever covers it. Placement derives from
 * the specs, so it lives in them and is never reported back to the host.
 */
import type { RectPose } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { diagramContainerOf } from '../containers/trait';
import { edgeRouter } from '../edge';
import { diagramEdgeOf } from '../edgeTrait';
import type { DiagramSpec } from '../fromData';
import { diagramGroupOf } from '../group';
import { diagramLabelOf, type DiagramLabel } from '../labelTrait';
import { diagramNodeOf } from '../trait';
import { specDeps, specWorldPoses } from '../specWorld';
import { placeLabels, type LabelPlacements, type PlaceLabel, type PlaceLabelsInput, type PlaceLabelsOptions, type PlaceRoute } from './place';

const routeOf = edgeRouter<RectPose>();

/** What placement reads off `specs`: every label moving. */
function inputOf(specs: readonly DiagramSpec[]): PlaceLabelsInput {
  const world = specWorldPoses(specs);
  const dep = specDeps(specs, world);
  const shapes: PlaceLabelsInput['shapes'][number][] = [];
  const routes: PlaceRoute[] = [];
  const labels: PlaceLabel[] = [];
  for (const spec of specs) {
    const id = spec.id as string;
    const ends = Array.isArray(spec.dependsOn) ? spec.dependsOn : [];
    if (diagramEdgeOf(spec) !== null) {
      const points = routeOf(spec, ends.map(dep))?.points;
      if (points !== undefined && points.length >= 2) routes.push({ id, points: points as Vec2[] });
      continue;
    }
    const placement = diagramLabelOf(spec);
    if (placement !== null) {
      const { width, height } = spec.pose;
      if (ends[0] !== undefined) labels.push({ id, edge: ends[0] as string, placement, size: { width, height } });
      continue;
    }
    const node = { id, kind: spec.kind, data: spec.data };
    if (spec.derivePose !== undefined || diagramContainerOf(node) !== null || diagramGroupOf(node) !== null || diagramNodeOf(node) === null) continue;
    shapes.push({ id, box: world.get(id) ?? spec.pose });
  }
  return { shapes, routes, labels };
}

const keyOf = (input: PlaceLabelsInput): string => JSON.stringify([
  input.shapes.map((s) => [s.id, s.box.x, s.box.y, s.box.width, s.box.height]),
  input.routes.map((r) => [r.id, r.points.flatMap((p) => [p.x, p.y])]),
  input.labels.map((l) => [l.id, l.edge, l.placement.at, l.placement.offset, l.placement.dodge, l.size.width, l.size.height]),
]);

/**
 * A function from specs to the same specs with each edge label placed off
 * whatever covers it. Every label is placed afresh, in id order, whenever
 * the shapes, routes, or labels change, and the last answer is reused while
 * they do not. Run it after any router, so labels dodge the routes drawn.
 */
export function createSpecLabelPlacer(opts: PlaceLabelsOptions = {}): (specs: readonly DiagramSpec[]) => DiagramSpec[] {
  let last: { key: string; placed: LabelPlacements } | null = null;
  return (specs) => {
    const input = inputOf(specs);
    if (input.labels.length === 0) return [...specs];
    const key = keyOf(input);
    if (last?.key !== key) last = { key, placed: placeLabels(input, opts) };
    const placed = last.placed;
    return specs.map((spec) => {
      const spot = placed.get(spec.id as string);
      const label = diagramLabelOf(spec);
      if (spot === undefined || label === null) return spec;
      const { placed: _p, ...preferred } = label;
      const next: DiagramLabel = spot === null ? preferred : { ...preferred, placed: spot };
      return { ...spec, data: { ...spec.data, diagram: { ...(spec.data.diagram as object), label: next } } };
    });
  };
}
