import { describe, expect, it, vi } from 'vitest';
import type { SnapDep } from '../snapDep';
import { captureMovePathSnap, snapMoveDelta } from './pathSnap';

const PRESS = { x: 11, y: 11 };

describe('a move snapping to paths', () => {
  it('takes its base point from the dragged geometry, then snaps it to everything else', () => {
    const toPaths = vi.fn((p: { x: number; y: number }, at?: { include?: readonly string[] }) =>
      (at?.include ? { x: 10, y: 10 } : p.x > 45 ? { x: 50, y: 50 } : null));
    const s = captureMovePathSnap({ point: (p) => p, toPaths } as SnapDep, PRESS, ['a']);
    expect(s?.base).toEqual({ x: 10, y: 10 });
    expect(toPaths).toHaveBeenCalledWith({ x: 11, y: 11 }, { include: ['a'] });

    expect(snapMoveDelta(s, 5, 5)).toEqual({ dx: 5, dy: 5 });
    expect(snapMoveDelta(s, 38, 41)).toEqual({ dx: 40, dy: 40 });
    expect(toPaths).toHaveBeenLastCalledWith({ x: 48, y: 51 }, { origin: { x: 10, y: 10 }, exclude: ['a'] });
  });

  it('leaves the delta alone without a snap dep that snaps to paths', () => {
    expect(captureMovePathSnap({ point: (p) => p }, PRESS, ['a'])).toBeNull();
    expect(snapMoveDelta(null, 3, 4)).toEqual({ dx: 3, dy: 4 });
  });
});
