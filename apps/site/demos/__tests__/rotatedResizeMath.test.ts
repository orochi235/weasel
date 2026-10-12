import { describe, expect, it } from 'vitest';
import {
  fixedCornerWorld, INITIAL_GREEN, medianPose, PANEL_IDS, PROJECTIONS, runResize,
} from '../rotatedResize/math';

const anchor = { x: 'min', y: 'min' } as const;
const resized = (panel: (typeof PANEL_IDS)[number]) =>
  runResize(PROJECTIONS[panel], INITIAL_GREEN, anchor, 40, 25);

describe('rotated resize math', () => {
  it('pins the fixed corner under the full math', () => {
    const before = fixedCornerWorld(INITIAL_GREEN, anchor);
    const after = fixedCornerWorld(resized('green'), anchor);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('lets it drift when the correction is dropped', () => {
    const before = fixedCornerWorld(INITIAL_GREEN, anchor);
    const after = fixedCornerWorld(resized('purple'), anchor);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(1);
  });

  it('takes the median of each pose component on its own', () => {
    const pose = (n: number) => ({ ...INITIAL_GREEN, x: n, y: -n, width: n * 2, height: 1, rotation: 0 });
    expect(medianPose(pose(3), pose(1), pose(2))).toMatchObject({ x: 2, y: -2, width: 4, height: 1 });
  });
});
