import { describe, expect, it } from 'vitest';
import type { CurveRepresentation } from '@weasel-js/geom/curves';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { View } from '@weasel-js/core';
import { createInflectionsLayer } from '../curveLab/overlays';

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/** A rep whose curvature runs `k(t)` along a horizontal line from x 0 to 128. */
function rep(k: (t: number) => number): CurveRepresentation {
  return { kind: 'test', curvatureAt: (_a: unknown, t: number) => k(t), evaluate: (_a: unknown, t: number) => ({ x: t * 128, y: 0 }) } as unknown as CurveRepresentation;
}

const markers = (k: (t: number) => number): DrawCommand[] =>
  (createInflectionsLayer(rep(k), () => [{ x: 0, y: 0 }, { x: 1, y: 0 }]).draw(undefined, VIEW, { width: 128, height: 1 } as never))
    .filter((c) => c.kind === 'path' && 'stroke' in c);

describe('curve lab inflections', () => {
  it('marks an inflection whose curvature lands on zero at a sample', () => {
    // Zero exactly at the middle sample, t = 0.5.
    expect(markers((t) => 0.5 - t)).toHaveLength(1);
  });

  it('marks one inflection across a straight run between opposite curvatures', () => {
    expect(markers((t) => (t < 0.25 ? 1 : t > 0.75 ? -1 : 0))).toHaveLength(1);
  });

  it('marks none across a straight run between curvatures of one sign', () => {
    expect(markers((t) => (t < 0.25 || t > 0.75 ? 1 : 0))).toHaveLength(0);
  });
});
