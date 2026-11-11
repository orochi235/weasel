/** Counterexamples the renderer's bounds property shrank to, kept as plain cases. */
import { describe, expect, it } from 'vitest';
import { tessellateStroke } from './stroke';

describe('vertexWidths in a stretched metric, shrunk', () => {
  it('scales a corner\'s world width along each of its two edges, not along their bisector', () => {
    // A transform stretching y 58 times its x: one world unit across a vertical edge is 0.131 metric units.
    const metric = { p: 0.13097472643005897, q: 0, r: 7.635060803383346 };
    const mesh = tessellateStroke(
      { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      { width: 0.0625, vertexWidths: [3, 0] },
      { metric },
    );
    let x0 = Infinity, x1 = -Infinity;
    for (let i = 0; i < mesh.vertices.length; i += 2) { x0 = Math.min(x0, mesh.vertices[i]!); x1 = Math.max(x1, mesh.vertices[i]!); }
    // A world width of at most 3 reaches 1.5 past a vertical edge, 6 at a miter of the default limit; it reached 62.
    expect(x0).toBeGreaterThanOrEqual(-6);
    expect(x1).toBeLessThanOrEqual(16);
  });
});
