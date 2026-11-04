// Its own file: the cutter's scratch buffer only grows, so a test run after
// larger cuts would pass whether or not the buffer is sized right.
import { expect, it } from 'vitest';
import type { Mesh } from '@weasel-js/geom/tessellate';
import { cutToTriangles } from './triangleCut';

it('cuts against sliver triangles that cross a plane at more than two edges', () => {
  // A routed wire's outline, as tessellated in a chart test.
  const mesh = (v: number[]): Mesh => ({ vertices: new Float32Array(v), indices: Uint32Array.from(v.slice(0, v.length / 2), (_, i) => i) });
  const ribbon = mesh([327.0815124511719, 47.33483123779297, 327.0788879394531, 47.343849182128906, 323.23907470703125, 46.22322463989258]);
  const fill = mesh([
    325.1596374511719, 46.78128433227539, 323.5194396972656, 52.37698745727539, 323.51043701171875, 52.406089782714844,
    325.1596374511719, 46.78128433227539, 323.51043701171875, 52.406089782714844, 321.7407531738281, 57.826011657714844,
    325.1596374511719, 46.78128433227539, 321.7407531738281, 57.826011657714844, 321.7185363769531, 57.88722610473633,
  ]);
  expect(() => cutToTriangles(ribbon, fill, false)).not.toThrow();
});
