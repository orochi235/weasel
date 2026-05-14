import { describe, expect, it } from 'vitest';
import { snapToGuides } from './snapToGuides';
import type { Guide } from 'features/guides/types';
import type { GestureContext, GroupTransform, ModifierState } from '../../types';

interface Pose { x: number; y: number }

function ctx(
  modifiers: Partial<ModifierState> = {},
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
    adapter: {} as never,
    scratch: {},
  };
}

const tt = (dx: number, dy: number): GroupTransform => ({ kind: 'translate', dx, dy });

describe('move/snapToGuides', () => {
  it('snaps within tolerance', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    const b = snapToGuides<Pose>({ getGuides: () => guides, tolerance: 5 });
    // origin (0,0); proposed (102, 50); snaps x → 100. transform → (100, 50).
    expect(b.onMove!(ctx(), tt(102, 50))).toEqual({
      transform: { kind: 'translate', dx: 100, dy: 50 },
    });
  });

  it('no result when outside tolerance', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    const b = snapToGuides<Pose>({ getGuides: () => guides, tolerance: 5 });
    expect(b.onMove!(ctx(), tt(110, 50))).toBeUndefined();
  });

  it('bypassKey suppresses snapping when held', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    const b = snapToGuides<Pose>({
      getGuides: () => guides,
      tolerance: 5,
      bypassKey: 'alt',
    });
    expect(b.onMove!(ctx({ alt: true }), tt(102, 50))).toBeUndefined();
  });

  it('uses live guide list each call', () => {
    let guides: Guide[] = [];
    const b = snapToGuides<Pose>({
      getGuides: () => guides,
      tolerance: 5,
    });
    expect(b.onMove!(ctx(), tt(102, 50))).toBeUndefined();
    guides = [{ id: 'g', axis: 'x', offset: 100 }];
    expect(b.onMove!(ctx(), tt(102, 50))).toEqual({
      transform: { kind: 'translate', dx: 100, dy: 50 },
    });
  });
});
