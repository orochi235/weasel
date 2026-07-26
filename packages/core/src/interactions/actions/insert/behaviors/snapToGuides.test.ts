import { describe, expect, it } from 'vitest';
import { snapToGuides } from './snapToGuides';
import type { Guide } from 'features/guides/types';
import type {
  GestureContext,
  InsertProposed,
  ModifierState,
} from '../../../gestures/types';

interface P { x: number; y: number }

function ctx(start: P, mods: Partial<ModifierState> = {}): GestureContext<P> {
  return {
    draggedIds: ['gesture'],
    origin: new Map([['gesture', start]]),
    current: new Map([['gesture', start]]),
    snap: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, ...mods },
    pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
    adapter: {} as never,
    scratch: {},
  };
}

function proposed(start: P, current: P): InsertProposed<P> {
  const bounds = {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
  return { start, current, bounds, pose: bounds as unknown as P };
}

describe('insert/snapToGuides', () => {
  it('onStart snaps origin to a nearby guide', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    const b = snapToGuides<P>({ getGuides: () => guides, tolerance: 5 });
    const c = ctx({ x: 102, y: 50 });
    b.onStart!(c);
    expect(c.origin.get('gesture')).toEqual({ x: 100, y: 50 });
  });

  it('onStart leaves origin alone when out of tolerance', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    const b = snapToGuides<P>({ getGuides: () => guides, tolerance: 5 });
    const c = ctx({ x: 110, y: 50 });
    b.onStart!(c);
    expect(c.origin.get('gesture')).toEqual({ x: 110, y: 50 });
  });

  it('onMove snaps current point on each axis independently', () => {
    const guides: Guide[] = [
      { id: 'vx', axis: 'x', offset: 100 },
      { id: 'hy', axis: 'y', offset: 50 },
    ];
    const b = snapToGuides<P>({ getGuides: () => guides, tolerance: 5 });
    const c = ctx({ x: 0, y: 0 });
    const r = b.onMove!(c, proposed({ x: 0, y: 0 }, { x: 102, y: 48 }));
    expect(r).toEqual({ current: { x: 100, y: 50 } });
  });

  it('onMove returns undefined outside tolerance', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    const b = snapToGuides<P>({ getGuides: () => guides, tolerance: 5 });
    const c = ctx({ x: 0, y: 0 });
    expect(b.onMove!(c, proposed({ x: 0, y: 0 }, { x: 110, y: 50 }))).toBeUndefined();
  });

  it('bypassKey skips both onStart and onMove', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    const b = snapToGuides<P>({
      getGuides: () => guides,
      tolerance: 5,
      bypassKey: 'alt',
    });
    const c = ctx({ x: 102, y: 0 }, { alt: true });
    b.onStart!(c);
    expect(c.origin.get('gesture')).toEqual({ x: 102, y: 0 }); // unchanged
    expect(b.onMove!(c, proposed({ x: 102, y: 0 }, { x: 102, y: 0 }))).toBeUndefined();
  });

  it('no guides → no-op', () => {
    const b = snapToGuides<P>({ getGuides: () => [], tolerance: 5 });
    const c = ctx({ x: 102, y: 50 });
    b.onStart!(c);
    expect(c.origin.get('gesture')).toEqual({ x: 102, y: 50 });
    expect(b.onMove!(c, proposed({ x: 102, y: 50 }, { x: 110, y: 50 }))).toBeUndefined();
  });
});
