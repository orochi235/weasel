import { describe, expect, it } from 'vitest';
import { PathBuilder, withCorner, type PolygonPath } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import { tessellateStroke } from './stroke';

const base: Stroke = { paint: { color: '#000' }, width: 4, cap: 'butt', join: 'bevel' };

describe('vertexWidths on a path with a cut corner', () => {
  it('stay on their anchors once the corner is expanded', () => {
    // Anchor 1's round cut adds an anchor, so a width read by expanded index
    // would land the last entry on the cut and leave the end at the stroke's 4.
    const path = withCorner(
      new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).build() as PolygonPath,
      1, { shape: 'round', radius: 20 },
    );
    const mesh = tessellateStroke(path, { ...base, vertexWidths: [2, 2, 10] });
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < mesh.vertices.length; i += 2) {
      if (Math.abs(mesh.vertices[i + 1] - 100) > 1e-4) continue;
      lo = Math.min(lo, mesh.vertices[i]);
      hi = Math.max(hi, mesh.vertices[i]);
    }
    expect(lo).toBeCloseTo(95, 4);
    expect(hi).toBeCloseTo(105, 4);
  });
});
