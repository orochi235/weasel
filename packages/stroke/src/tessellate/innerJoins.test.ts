import { describe, expect, it } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { tessellate, type Mesh } from '@weasel-js/geom/tessellate';
import type { Stroke } from '@weasel-js/paint';
import { tessellateStroke } from './stroke';
import { strokeToPath } from '../strokeToPath';

/** Total triangle area, overlap counted as often as it is covered. */
function area(mesh: Mesh): number {
  const v = mesh.vertices;
  let a = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [p, q, r] = [mesh.indices[i] * 2, mesh.indices[i + 1] * 2, mesh.indices[i + 2] * 2];
    a += Math.abs((v[q] - v[p]) * (v[r + 1] - v[p + 1]) - (v[r] - v[p]) * (v[q + 1] - v[p + 1])) / 2;
  }
  return a;
}

const SHAPES: [string, string][] = [
  ['a closed square', 'M 0 0 L 100 0 L 100 100 L 0 100 Z'],
  ['an open zigzag', 'M 0 0 L 60 30 L 0 60 L 60 90'],
  ['a closed triangle', 'M 0 0 L 100 10 L 30 90 Z'],
  ['a circle', 'M 100 50 C 100 77 77 100 50 100 C 23 100 0 77 0 50 C 0 23 23 0 50 0 C 77 0 100 23 100 50 Z'],
  ['an open S curve', 'M 0 50 C 30 0 60 100 100 50'],
];

describe('a ribbon covers each point of its stroke once', () => {
  for (const join of ['miter', 'bevel', 'round'] as const) {
    for (const [name, d] of SHAPES) {
      it(`${join}: ${name}`, () => {
        const path = pathFromD(d);
        const stroke: Stroke = { width: 10, join, cap: 'butt' };
        const ribbon = tessellateStroke(path, stroke, { flattenTolerance: 0.1 });
        const covered = area(tessellate(strokeToPath(path, stroke, { flattenTolerance: 0.1 })));
        expect(area(ribbon)).toBeCloseTo(covered, 0);
      });
    }
  }

  it('the closed square, mitered, covers 110 x 110 less 90 x 90', () => {
    expect(area(tessellateStroke(pathFromD(SHAPES[0][1]), { width: 10, join: 'miter' }))).toBeCloseTo(4000, 3);
  });
});
