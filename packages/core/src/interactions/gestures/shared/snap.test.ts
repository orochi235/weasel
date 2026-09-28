import { describe, expect, it, vi } from 'vitest';
import { snap } from './snap';
import type { GestureContext, GroupTransform, SnapStrategy } from '../types';
import { gridSnapStrategy } from './strategies/grid';
import { polygonFromPoints, type Path } from 'features/paths';

interface Pose { x: number; y: number }

function ctx(
  modifiers: Partial<GestureContext<Pose>['modifiers']> = {},
  origin: Pose = { x: 0, y: 0 },
): GestureContext<Pose> {
  const o = new Map<string, Pose>();
  o.set('a', origin);
  return {
    draggedIds: ['a'],
    origin: o,
    current: new Map(),
    snap: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, ...modifiers },
    pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
    view: null,
    adapter: {} as any,
    scratch: {},
  };
}

function fixedStrategy(result: Pose | null): SnapStrategy<Pose> {
  return { snap: vi.fn().mockReturnValue(result) };
}

const tt = (dx: number, dy: number): GroupTransform => ({ kind: 'translate', dx, dy });

describe('snap', () => {
  it('returns a translate transform derived from the snapped pose', () => {
    // origin = (0,0); transform dx=1.7,dy=3.9 → proposed = (1.7,3.9);
    // strategy snaps to (2,4); resulting transform dx=2, dy=4.
    const strategy = fixedStrategy({ x: 2, y: 4 });
    const b = snap(strategy);
    const result = b.onMove!(ctx(), tt(1.7, 3.9));
    expect(result).toEqual({ transform: { kind: 'translate', dx: 2, dy: 4 } });
  });

  it('bypassKey suppresses strategy when held', () => {
    const strategy = fixedStrategy({ x: 2, y: 4 });
    const b = snap(strategy, { bypassKey: 'alt' });
    const result = b.onMove!(ctx({ alt: true }), tt(1.7, 3.9));
    expect(result).toBeUndefined();
    expect((strategy.snap as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('bypassKey does not suppress when a different modifier is held', () => {
    const strategy = fixedStrategy({ x: 2, y: 4 });
    const b = snap(strategy, { bypassKey: 'alt' });
    const result = b.onMove!(ctx({ shift: true }), tt(1.7, 3.9));
    expect(result).toEqual({ transform: { kind: 'translate', dx: 2, dy: 4 } });
  });

  it('strategy returning null is a no-op (gesture forwards original transform)', () => {
    const strategy = fixedStrategy(null);
    const b = snap(strategy);
    const result = b.onMove!(ctx(), tt(1.7, 3.9));
    expect(result).toBeUndefined();
  });

  it('passes the reconstructed proposed pose to the strategy', () => {
    const strategy: SnapStrategy<Pose> = { snap: vi.fn().mockReturnValue({ x: 0, y: 0 }) };
    const b = snap(strategy);
    const c = ctx({ shift: true }, { x: 0, y: 0 });
    b.onMove!(c, tt(1, 2));
    expect(strategy.snap).toHaveBeenCalledWith({ x: 1, y: 2 }, c);
  });

  it('derives delta against the primary origin, not (0,0)', () => {
    // origin = (10, 20); proposed = (11.7, 23.9); snap → (12, 24);
    // expected transform = (12 - 10, 24 - 20) = (2, 4).
    const strategy = fixedStrategy({ x: 12, y: 24 });
    const b = snap(strategy);
    const result = b.onMove!(ctx({}, { x: 10, y: 20 }), tt(1.7, 3.9));
    expect(result).toEqual({ transform: { kind: 'translate', dx: 2, dy: 4 } });
  });
});

describe('snap on a Path pose', () => {
  it('derives a finite delta from the path bounds when no origin projection is passed', () => {
    const tri = polygonFromPoints([
      { x: 83, y: 47 },
      { x: 120, y: 47 },
      { x: 100, y: 90 },
    ]);
    const c = { ...ctx(), origin: new Map<string, Path>([['a', tri]]) } as unknown as GestureContext<Path>;
    const b = snap(gridSnapStrategy<Path>(20));
    // bounds origin (83,47) + (5,5) = (88,52) → grid (80,60) → delta (-3,13).
    expect(b.onMove!(c, tt(5, 5))).toEqual({ transform: { kind: 'translate', dx: -3, dy: 13 } });
  });
});
