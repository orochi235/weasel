import type { Guide } from '../types';
import type { AlignBounds, DeriveAlignmentGuidesOptions } from './types';

const EPS = 1e-3;

/** Derive candidate alignment lines from a set of AABBs (siblings) plus an
 *  optional page box. Each box contributes up to 3 guides per axis: the two
 *  edges and the center. Overlapping offsets collapse to one candidate. */
export function deriveAlignmentGuides(
  targets: readonly AlignBounds[],
  opts: DeriveAlignmentGuidesOptions = {},
): Guide[] {
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

  for (const b of targets) emit(b);
  if (opts.page) emit(opts.page);

  return [...seenX.values(), ...seenY.values()];
}
