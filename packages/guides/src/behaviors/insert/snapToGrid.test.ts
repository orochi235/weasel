import { describe, expect, it } from 'vitest';
import { snapToGrid } from './snapToGrid';
import type {
  GestureContext,
  InsertProposed,
  ModifierState,
} from '@weasel-js/core';

interface P { x: number; y: number }

function ctx(start: P, mods: Partial<ModifierState> = {}): GestureContext<P> {
  return {
    draggedIds: ['gesture'],
    origin: new Map([['gesture', start]]),
    current: new Map([['gesture', start]]),
    snap: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, ...mods },
    pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
    view: null,
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

describe('insert/snapToGrid', () => {
  const b = snapToGrid<P>({ spacing: 1 });

  it('onStart snaps origin to grid', () => {
    const c = ctx({ x: 0.7, y: 0.3 });
    b.onStart!(c);
    expect(c.origin.get('gesture')).toEqual({ x: 1, y: 0 });
  });

  it('onMove returns snapped current; passes start through', () => {
    const c = ctx({ x: 1, y: 0 });
    const r = b.onMove!(c, proposed({ x: 1, y: 0 }, { x: 4.6, y: 2.3 }));
    expect(r).toEqual({ current: { x: 5, y: 2 } });
  });

  it('bypassKey skips both', () => {
    const b2 = snapToGrid<P>({ spacing: 1, bypassKey: 'alt' });
    const c = ctx({ x: 0.7, y: 0.3 }, { alt: true });
    b2.onStart!(c);
    expect(c.origin.get('gesture')).toEqual({ x: 0.7, y: 0.3 }); // unchanged
    const r = b2.onMove!(c, proposed({ x: 0.7, y: 0.3 }, { x: 4.6, y: 2.3 }));
    expect(r).toBeUndefined();
  });
});

// The poses are in a plane whose world is the camera's doubled and shifted:
// plane = 2 * camera + 10 on x, 2 * camera on y.
const plane = { scale: { x: 2, y: 2 }, offset: { x: 10, y: 0 } };

describe('insert/snapToGrid on a parallax plane', () => {
  it('rounds the start and the live point to the camera\'s grid as it lies in the plane', () => {
    const b = snapToGrid<P>({ spacing: 20 });
    const c = { ...ctx({ x: 207, y: 84 }), plane };
    b.onStart!(c);
    expect(c.origin.get('gesture')).toEqual({ x: 210, y: 80 });
    expect(b.onMove!(c, proposed({ x: 210, y: 80 }, { x: 255, y: 123 }))).toEqual({ current: { x: 250, y: 120 } });
  });
});
