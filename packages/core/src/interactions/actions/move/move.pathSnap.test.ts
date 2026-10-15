import { describe, expect, it, vi } from 'vitest';
import type { InvocationCtx } from '@weasel-js/routing';
import { captureMovePathSnap, snapMoveDelta } from './pathSnap';

const ctxWith = (snap: unknown): InvocationCtx => ({
  world: { x: 12, y: 12 },
  screen: { x: 0, y: 0 },
  modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  drag: { start: { x: 11, y: 11 } } as InvocationCtx['drag'],
  deps: { snap } as InvocationCtx['deps'],
});

describe('a move snapping to paths', () => {
  it('takes its base point from the dragged geometry, then snaps it to everything else', () => {
    const toPaths = vi.fn((p: { x: number; y: number }, at?: { include?: readonly string[] }) =>
      (at?.include ? { x: 10, y: 10 } : p.x > 45 ? { x: 50, y: 50 } : null));
    const s = captureMovePathSnap(ctxWith({ point: (p: unknown) => p, toPaths }), ['a']);
    expect(s?.base).toEqual({ x: 10, y: 10 });
    expect(toPaths).toHaveBeenCalledWith({ x: 11, y: 11 }, { include: ['a'] });

    expect(snapMoveDelta(s, 5, 5)).toEqual({ dx: 5, dy: 5 });
    expect(snapMoveDelta(s, 38, 41)).toEqual({ dx: 40, dy: 40 });
    expect(toPaths).toHaveBeenLastCalledWith({ x: 48, y: 51 }, { origin: { x: 10, y: 10 }, exclude: ['a'] });
  });

  it('leaves the delta alone without a snap dep that snaps to paths', () => {
    expect(captureMovePathSnap(ctxWith({ point: (p: unknown) => p }), ['a'])).toBeNull();
    expect(snapMoveDelta(null, 3, 4)).toEqual({ dx: 3, dy: 4 });
  });
});
