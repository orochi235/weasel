import { describe, expect, it } from 'vitest';
import { snapToGrid } from './snapToGrid';
import type { GestureContext, GroupTransform } from '../../types';

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

  it('preserves the snapped grid for non-zero origins', () => {
    interface FullPose { x: number; y: number; widthFt: number }
    const o = new Map<string, FullPose>();
    o.set('a', { x: 0, y: 0, widthFt: 4 });
    const c: GestureContext<FullPose> = {
      draggedIds: ['a'],
      origin: o,
      current: new Map(),
      snap: null,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
      adapter: {} as any,
      scratch: {},
    };
    const b = snapToGrid<FullPose>({ spacing: 0.5 });
    const result = b.onMove!(c, tt(0.3, 0.7));
    expect(result).toEqual({ transform: { kind: 'translate', dx: 0.5, dy: 0.5 } });
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
