import { describe, expect, it } from 'vitest';
import { snapToGuides } from './snapToGuides';
import type { Guide } from 'features/guides/types';
import type { GestureContext, ModifierState } from '../../types';

interface Pose { x: number; y: number }

function ctx(modifiers: Partial<ModifierState> = {}): GestureContext<Pose> {
  return {
    draggedIds: ['a'],
    origin: new Map(),
    current: new Map(),
    snap: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, ...modifiers },
    pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
    adapter: {} as never,
    scratch: {},
  };
}

describe('move/snapToGuides', () => {
  it('snaps within tolerance', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    const b = snapToGuides<Pose>({ getGuides: () => guides, tolerance: 5 });
    expect(b.onMove!(ctx(), { x: 102, y: 50 })).toEqual({
      pose: { x: 100, y: 50 },
    });
  });

  it('no result when outside tolerance', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    const b = snapToGuides<Pose>({ getGuides: () => guides, tolerance: 5 });
    expect(b.onMove!(ctx(), { x: 110, y: 50 })).toBeUndefined();
  });

  it('bypassKey suppresses snapping when held', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    const b = snapToGuides<Pose>({
      getGuides: () => guides,
      tolerance: 5,
      bypassKey: 'alt',
    });
    expect(b.onMove!(ctx({ alt: true }), { x: 102, y: 50 })).toBeUndefined();
  });

  it('uses live guide list each call', () => {
    let guides: Guide[] = [];
    const b = snapToGuides<Pose>({
      getGuides: () => guides,
      tolerance: 5,
    });
    expect(b.onMove!(ctx(), { x: 102, y: 50 })).toBeUndefined();
    guides = [{ id: 'g', axis: 'x', offset: 100 }];
    expect(b.onMove!(ctx(), { x: 102, y: 50 })).toEqual({
      pose: { x: 100, y: 50 },
    });
  });
});
