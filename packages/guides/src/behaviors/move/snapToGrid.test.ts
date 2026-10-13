import { describe, expect, it } from 'vitest';
import { snapToGrid } from './snapToGrid';
import type { GestureContext, GroupTransform } from '@weasel-js/core';

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

const tt = (dx: number, dy: number): GroupTransform => ({ kind: 'translate', dx, dy });

describe('snapToGrid', () => {
  it('returns a translate transform whose delta lands on the grid', () => {
    const b = snapToGrid<Pose>({ spacing: 1 });
    const result = b.onMove!(ctx(), tt(1.4, 2.6));
    expect(result).toEqual({ transform: { kind: 'translate', dx: 1, dy: 3 } });
  });

  it('snaps where the pose lands, not the delta, for an off-grid origin', () => {
    const b = snapToGrid<Pose>({ spacing: 0.5 });
    // 0.2 + 0.2 lands on 0.5; the delta alone would round to 0.
    const result = b.onMove!(ctx({}, { x: 0.2, y: 0.2 }), tt(0.2, 0.2));
    const t = result?.transform as { dx: number; dy: number };
    expect(t.dx).toBeCloseTo(0.3);
    expect(t.dy).toBeCloseTo(0.3);
  });

  it('bypassKey suppresses snapping when held', () => {
    const b = snapToGrid<Pose>({ spacing: 1, bypassKey: 'alt' });
    const result = b.onMove!(ctx({ alt: true }), tt(1.4, 2.6));
    expect(result).toBeUndefined();
  });

  it('bypassKey does not suppress when other modifier held', () => {
    const b = snapToGrid<Pose>({ spacing: 1, bypassKey: 'alt' });
    const result = b.onMove!(ctx({ shift: true }), tt(1.4, 2.6));
    expect(result).toEqual({ transform: { kind: 'translate', dx: 1, dy: 3 } });
  });
});
