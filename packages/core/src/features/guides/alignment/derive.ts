import type { Guide } from '../types';
import type { AlignBounds, AlignBoundsProjection, DeriveAlignmentGuidesOptions } from './types';
import { RECT_ALIGN_PROJECTION } from './match';

const EPS = 1e-3;

/** Derive candidate alignment lines from a set of sibling poses plus an
 *  optional page box. Each box contributes up to 3 guides per axis: the two
 *  edges and the center. Overlapping offsets collapse to one candidate.
 *  Poses go through the same projection `alignMoveBehavior` matches with, so
 *  a rotated sibling advertises its ink edges rather than its stored box. */
export function deriveAlignmentGuides<TPose = AlignBounds>(
  targets: readonly TPose[],
  opts: DeriveAlignmentGuidesOptions<TPose> = {},
): Guide[] {
  const proj = opts.projection
    ?? (RECT_ALIGN_PROJECTION as unknown as AlignBoundsProjection<TPose>);
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

  const emit = (b: AlignBounds): void => {
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

  for (const t of targets) emit(proj.boundsOf(t));
  if (opts.page) emit(opts.page);

  return [...seenX.values(), ...seenY.values()];
}
