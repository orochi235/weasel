import { describe, it, expect } from 'vitest';
import { PATH_L, PATH_M, type PolygonPath } from '@weasel-js/geom';
import { tessellateStroke } from './stroke';

// Out to (10, 0) and straight back: a turn of exactly 180°.
const BACK: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L, PATH_L]),
  coords: new Float32Array([0, 0, 10, 0, 2, 0]),
  fillRule: 'nonzero',
};

function maxX(vertices: Float32Array): number {
  let m = -Infinity;
  for (let i = 0; i < vertices.length; i += 2) m = Math.max(m, vertices[i]);
  return m;
}

describe('tessellateStroke at a 180° turn', () => {
  it('rounds a round join around the tip, as a round cap would', () => {
    const mesh = tessellateStroke(BACK, { paint: { color: '#000' }, width: 4, join: 'round' });
    expect(maxX(mesh.vertices)).toBeCloseTo(12, 5);
  });

  it('leaves a miter join flat at the tip, its miter being unbounded', () => {
    const mesh = tessellateStroke(BACK, { paint: { color: '#000' }, width: 4, join: 'miter' });
    expect(maxX(mesh.vertices)).toBeCloseTo(10, 5);
  });
});
