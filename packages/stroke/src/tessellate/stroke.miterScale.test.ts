import { describe, it, expect } from 'vitest';
import { PathBuilder } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import { tessellateStroke } from './stroke';

const elbow = (s: number) => new PathBuilder().moveTo(0, 0).lineTo(3 * s, 0).lineTo(3 * s, 3 * s).build();
const stroke = (s: number): Stroke => ({ paint: { kind: 'solid', color: '#000' }, width: s, join: 'miter' });

describe('a miter join at a small scale', () => {
  it('draws the miter it draws at a large one', () => {
    const big = tessellateStroke(elbow(1), stroke(1));
    const small = tessellateStroke(elbow(1e-5), stroke(1e-5));
    expect(small.vertices.length).toBe(big.vertices.length);
    // The apex, out past both outer edges.
    const apex = (m: { vertices: Float32Array }, s: number) => Array.from({ length: m.vertices.length / 2 })
      .some((_, i) => Math.abs(m.vertices[i * 2] - 3.5 * s) < 1e-3 * s && Math.abs(m.vertices[i * 2 + 1] + 0.5 * s) < 1e-3 * s);
    expect(apex(big, 1)).toBe(true);
    expect(apex(small, 1e-5)).toBe(true);
  });
});
