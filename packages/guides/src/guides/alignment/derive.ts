import type { Guide } from '../types';
import type { DeriveAlignmentGuidesOptions } from './types';
import {
  type Bounds,
  type PoseDescriptor,
  visualBoundsViaDescriptor,
  AUTO_POSE_DESCRIPTOR,
} from '@weasel-js/core';

const EPS = 1e-3;

/** Derive candidate alignment lines from a set of sibling poses plus an
 *  optional page box. Each box contributes up to 3 guides per axis: the two
 *  edges and the center. Overlapping offsets collapse to one candidate, whose
 *  `span` covers every box that produced it.
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

  const add = (axis: 'x' | 'y', offset: number, b: Bounds): void => {
    const seen = axis === 'x' ? seenX : seenY;
    const key = Math.round(offset / EPS);
    const min = axis === 'x' ? b.y : b.x;
    const max = min + (axis === 'x' ? b.height : b.width);
    const prev = seen.get(key);
    if (prev) {
      prev.span = { min: Math.min(prev.span!.min, min), max: Math.max(prev.span!.max, max) };
      return;
    }
    seen.set(key, { id: `align:${axis}:${offset.toFixed(3)}`, axis, offset, span: { min, max } });
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

  for (const t of targets) emit(visualBoundsViaDescriptor(t, d));
  if (opts.page) emit(opts.page);

  return [...seenX.values(), ...seenY.values()];
}
