import { rectToPlane, type PlaneMap } from '@weasel-js/core';
import type { Guide, SpacingGap } from '../types';
import { guideOffsetOn } from '../../strategies/onPlane';
import type { AlignmentBehaviorBase } from './types';

type Axis = 'x' | 'y';
const across = (axis: Axis): Axis => (axis === 'x' ? 'y' : 'x');

const into = (m: PlaneMap, axis: Axis, v: number): number => v * m.scale[axis] + m.offset[axis];
const outOf = (m: PlaneMap, axis: Axis, v: number): number => (v - m.offset[axis]) / m.scale[axis];

/** `min` and `max` through `map`, put back in order where the axis is flipped. */
function range<R extends { min: number; max: number }>(r: R, map: (v: number) => number): R {
  const a = map(r.min);
  const b = map(r.max);
  return { ...r, min: Math.min(a, b), max: Math.max(a, b) };
}

function guideToPlane(g: Guide, m: PlaneMap): Guide {
  const span = g.span && range(g.span, (v) => into(m, across(g.axis), v));
  return { ...g, offset: guideOffsetOn(g, m), ...(span ? { span } : {}) };
}

function guideFromPlane(g: Guide, m: PlaneMap): Guide {
  const span = g.span && range(g.span, (v) => outOf(m, across(g.axis), v));
  return { ...g, offset: outOf(m, g.axis, g.offset), ...(span ? { span } : {}) };
}

function gapFromPlane(g: SpacingGap, m: PlaneMap): SpacingGap {
  return { ...range(g, (v) => outOf(m, g.axis, v)), at: outOf(m, across(g.axis), g.at) };
}

/**
 * `args` as a gesture whose poses are in `plane` reads them. A caller's
 * candidate lines and spacing boxes are in the camera's world, and so is what
 * it is told to draw; the matching between runs in the plane, where the poses
 * are. With no plane this is `args` itself.
 */
export function alignmentOnPlane<A extends AlignmentBehaviorBase>(args: A, plane: PlaneMap | null | undefined): A {
  if (!plane) return args;
  const spacing = args.getSpacingTargets;
  const setGaps = args.setActiveGaps;
  return {
    ...args,
    getCandidates: () => args.getCandidates().map((g) => guideToPlane(g, plane)),
    setActiveGuides: (guides) => args.setActiveGuides(guides.map((g) => guideFromPlane(g, plane))),
    ...(spacing ? { getSpacingTargets: () => spacing().map((b) => rectToPlane(plane, b)) } : {}),
    ...(setGaps ? { setActiveGaps: (gaps: readonly SpacingGap[]) => setGaps(gaps.map((g) => gapFromPlane(g, plane))) } : {}),
  };
}
