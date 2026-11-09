import type { Guide } from '../types';
import type { DeriveAlignmentGuidesOptions } from './types';
import {
  type Bounds,
  type PoseDescriptor,
  rectFromPlane,
  visualBoundsViaDescriptor,
  AUTO_POSE_DESCRIPTOR,
} from '@weasel-js/core';

const EPS = 1e-3;

/** Derive candidate alignment lines from a set of sibling poses plus an
 *  optional page box. Each box contributes up to 3 guides per axis: the two
 *  edges and the center. Overlapping offsets collapse to one candidate, whose
 *  `span` covers every box that produced it.
 *  Poses go through `opts.poseDescriptor`, so a rotated sibling advertises
 *  its ink edges rather than its stored box.
 *  The moving selection is measured with its stroke (`drawnBoundsOf`), so
 *  pass each sibling's `drawnAABBOf` box as its target for the two to agree.
 *  The lines are in the camera's world: a sibling on a parallax layer needs
 *  `planeOf` to say which plane its pose is in. */
export function deriveAlignmentGuides<TPose = Bounds>(
  targets: readonly TPose[],
  opts: DeriveAlignmentGuidesOptions<TPose> = {},
): Guide[] {
  const d = (opts.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;
  const edges = opts.edges ?? true;
  const centers = opts.centers ?? true;
  const found: Candidate[] = [];
  const add = (axis: 'x' | 'y', offset: number, b: Bounds): void => {
    const min = axis === 'x' ? b.y : b.x;
    const max = min + (axis === 'x' ? b.height : b.width);
    found.push({ axis, offset, min, max, order: found.length });
  };

  const emit = (b: Bounds): void => {
    if (edges) {
      add('x', b.x, b);
      add('x', b.x + b.width, b);
      add('y', b.y, b);
      add('y', b.y + b.height, b);
    }
    if (centers) {
      add('x', b.x + b.width / 2, b);
      add('y', b.y + b.height / 2, b);
    }
  };

  targets.forEach((t, i) => {
    const box = visualBoundsViaDescriptor(t, d);
    const plane = opts.planeOf?.(t, i);
    emit(plane ? rectFromPlane(plane, box) : box);
  });
  if (opts.page) emit(opts.page);

  return [...merged(found, 'x'), ...merged(found, 'y')];
}

interface Candidate { axis: 'x' | 'y'; offset: number; min: number; max: number; order: number }

/** `axis`'s candidates, those within `EPS` of the lowest offset in their run merged into one guide: the
 *  first one found names it and places it, and its span covers all of them. In the order they were found. */
function merged(found: readonly Candidate[], axis: 'x' | 'y'): Guide[] {
  const sorted = found.filter((c) => c.axis === axis).sort((a, b) => a.offset - b.offset);
  const runs: Candidate[][] = [];
  for (const c of sorted) {
    const run = runs[runs.length - 1];
    if (run && c.offset - run[0]!.offset <= EPS) run.push(c);
    else runs.push([c]);
  }
  return runs
    .map((run) => {
      const first = run.reduce((a, b) => (b.order < a.order ? b : a));
      const span = { min: Math.min(...run.map((c) => c.min)), max: Math.max(...run.map((c) => c.max)) };
      return { order: first.order, guide: { id: `align:${axis}:${first.offset.toFixed(3)}`, axis, offset: first.offset, span } };
    })
    .sort((a, b) => a.order - b.order)
    .map((r) => r.guide);
}
