import { describe, expect, it } from 'vitest';
import { clampMove } from './clampMove';
import type { GestureContext, GroupTransform } from '../../../gestures/types';

interface Pose { x: number; y: number; width: number; height: number }

function ctx(origin: Record<string, Pose>): GestureContext<Pose> {
  return {
    draggedIds: Object.keys(origin),
    origin: new Map(Object.entries(origin)),
    current: new Map(),
    snap: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
    view: null,
    adapter: {} as never,
    scratch: {},
  } as unknown as GestureContext<Pose>;
}

const t = (dx: number, dy: number): GroupTransform => ({ kind: 'translate', dx, dy });
const BOX = { x: 0, y: 0, width: 100, height: 50 };

describe('clampMove', () => {
  it('leaves a translation that stays inside alone', () => {
    const b = clampMove<Pose>({ bounds: BOX });
    expect(b.onMove!(ctx({ a: { x: 10, y: 10, width: 10, height: 10 } }), t(20, 5))).toBeUndefined();
  });

  it('stops the dragged box at each edge', () => {
    const b = clampMove<Pose>({ bounds: BOX });
    const c = ctx({ a: { x: 10, y: 10, width: 10, height: 10 } });
    expect(b.onMove!(c, t(500, -500))).toEqual({ transform: t(80, -10) });
    expect(b.onMove!(c, t(-500, 500))).toEqual({ transform: t(-10, 30) });
  });

  it('clamps a multi-node drag by the box around all of them', () => {
    const b = clampMove<Pose>({ bounds: () => BOX });
    const c = ctx({
      a: { x: 10, y: 10, width: 10, height: 10 },
      b: { x: 60, y: 20, width: 10, height: 10 },
    });
    expect(b.onMove!(c, t(100, 0))).toEqual({ transform: t(30, 0) });
  });
});
