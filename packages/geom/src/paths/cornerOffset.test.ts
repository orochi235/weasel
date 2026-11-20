import { describe, expect, it } from 'vitest';
import { PathBuilder } from './builder';
import { withCorner } from './cornerSpec';
import { offsetCornerTraces } from './cornerOffset';
import type { CornerShape } from './cornerShape';

const square = (shape: CornerShape) => withCorner(
  new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).lineTo(0, 100).close().build(),
  0, { shape, radius: 10 },
);

describe('offsetCornerTraces', () => {
  it.each(['round', 'bevel', 'square'] as const)('moves a convex %s corner outward on a grown outline', (shape) => {
    const [trace] = offsetCornerTraces(square(shape), 2);
    expect(trace.anchor.x).toBeCloseTo(-2);
    expect(trace.anchor.y).toBeCloseTo(-2);
    expect(trace.spec.radius).toBeCloseTo(12);
  });

  it.each(['round', 'square'] as const)('moves a concave %s corner into its notch on a grown outline', (shape) => {
    const ell = withCorner(
      new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 50).lineTo(50, 50).lineTo(50, 100).lineTo(0, 100).close().build(),
      3, { shape, radius: 10 },
    );
    const [trace] = offsetCornerTraces(ell, 2);
    expect(trace.anchor.x).toBeCloseTo(52);
    expect(trace.anchor.y).toBeCloseTo(52);
    expect(trace.spec.radius).toBeCloseTo(8);
  });
});
