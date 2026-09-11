import type { Guide } from '../types';
import type { DeriveAlignmentGuidesOptions } from './types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import { visualBoundsViaDescriptor } from 'core/geometry/poseDescriptor';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';

const EPS = 1e-3;

/** Derive candidate alignment lines from a set of sibling poses plus an
 *  optional page box. Each box contributes up to 3 guides per axis: the two
 *  edges and the center. Overlapping offsets collapse to one candidate.
 *  Poses go through the same descriptor `alignMoveBehavior` matches with, so
 *  a rotated sibling advertises its ink edges rather than its stored box. */
export function deriveAlignmentGuides<TPose = Bounds>(
  targets: readonly TPose[],
  opts: DeriveAlignmentGuidesOptions<TPose> = {},
): Guide[] {
  const d = (opts.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;
  const edges = opts.edges ?? true;
  const centers = opts.centers ?? true;
  // Dedup per axis: key = rounded offset. First writer wins (stable id).
  const seenX = new Map<number, Guide>();
  const seenY = new Map<number, Guide>();

  const add = (axis: 'x' | 'y', offset: number): void => {
    const seen = axis === 'x' ? seenX : seenY;
    const key = Math.round(offset / EPS);
    if (seen.has(key)) return;
    seen.set(key, { id: `align:${axis}:${offset.toFixed(3)}`, axis, offset });
  };

  const emit = (b: Bounds): void => {
    if (edges) {
      add('x', b.x);
      add('x', b.x + b.width);
      add('y', b.y);
      add('y', b.y + b.height);
    }
    if (centers) {
      add('x', b.x + b.width / 2);
      add('y', b.y + b.height / 2);
    }
  };

  for (const t of targets) emit(visualBoundsViaDescriptor(t, d));
  if (opts.page) emit(opts.page);

  return [...seenX.values(), ...seenY.values()];
}
