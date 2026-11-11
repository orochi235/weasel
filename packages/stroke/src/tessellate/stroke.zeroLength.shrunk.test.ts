import { describe, expect, it } from 'vitest';
import { PATH_M, PATH_Z, type PolygonPath } from '@weasel-js/geom';
import { tessellateStroke } from './stroke';

// Shrunk from pdf's writer property tests (2026-11-10).
describe('tessellateStroke, shrunk counterexamples', () => {
  it('draws a dot past 2^53 from the origin rather than throwing', () => {
    const far: PolygonPath = {
      kind: 'polygon', commands: Uint8Array.from([PATH_M, PATH_M, PATH_Z]), coords: Float32Array.from([0, 0, 3e38, 0]), fillRule: 'nonzero',
    };
    for (const cap of ['round', 'square'] as const) {
      const mesh = tessellateStroke(far, { paint: { color: '#000' }, width: 1, cap });
      expect(mesh.indices.length).toBeGreaterThan(0);
      expect(Array.from(mesh.vertices).every(Number.isFinite)).toBe(true);
    }
  });
});
