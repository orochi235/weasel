import { describe, expect, it } from 'vitest';
import { DEFAULT_SYMMETRY } from './kinds';
import { latticePoints } from './wallpaper';

describe('latticePoints, shrunk', () => {
  it('holds the center of a lattice spaced near the double range, whose determinant overflows', () => {
    const k = 1.0069051539961507e153;
    const pts = latticePoints({
      ...DEFAULT_SYMMETRY, kind: 'wallpaper', angle: 0, spacing: -20 * k, rowAngle: 0.3, rowSpacing: 20 * k,
      extent: { x: -30 * k, y: -30 * k, width: 60 * k, height: 60 * k },
    });
    expect(pts).toContainEqual({ i: 0, j: 0, x: 0, y: 0 });
  });
});
