import { describe, expect, it } from 'vitest';
import { createLongPressStore, type PendingLongPress } from './pressState';
import { PRESS_RING_RADIUS, PRESS_RING_WIDTH, pressRingAt, pressRingWaitAt, ringArcPoints } from './pressRing';

const press = (over: Partial<PendingLongPress> = {}): PendingLongPress => ({
  pointerId: 1,
  pointerType: 'touch',
  client: { x: 0, y: 0 },
  local: { x: 40, y: 30 },
  world: { x: 0, y: 0 },
  viewId: null,
  startedAt: 1000,
  duration: 500,
  armed: true,
  ...over,
});

const held = (over: Partial<PendingLongPress> = {}) => {
  const store = createLongPressStore();
  store.set(press(over));
  return store;
};

describe('pressRingAt', () => {
  it('shows nothing with no press, for a press that will fire nothing, or before the delay', () => {
    expect(pressRingAt(createLongPressStore(), 2000)).toBeNull();
    expect(pressRingAt(held({ armed: false }), 2000)).toBeNull();
    expect(pressRingAt(held(), 1119)).toBeNull();
    expect(pressRingAt(held(), 1049, { delay: 50 })).toBeNull();
  });

  it('fills over the hold around the press point', () => {
    expect(pressRingAt(held(), 1250)).toEqual({
      x: 40, y: 30, radius: PRESS_RING_RADIUS, width: PRESS_RING_WIDTH, fill: 0.5,
    });
    expect(pressRingAt(held(), 1250, { radius: 10, width: 1 })).toMatchObject({ radius: 10, width: 1 });
  });

  it('shows a full static ring when held still', () => {
    expect(pressRingAt(held(), 1200, { still: true })?.fill).toBe('full');
  });
});

describe('pressRingWaitAt', () => {
  it('counts down to the ring, and is null when no press will show one', () => {
    expect(pressRingWaitAt(held(), 1020)).toBe(100);
    expect(pressRingWaitAt(held(), 1500)).toBe(0);
    expect(pressRingWaitAt(held({ armed: false }), 1020)).toBeNull();
    expect(pressRingWaitAt(createLongPressStore(), 1020)).toBeNull();
  });
});

describe('ringArcPoints', () => {
  it('starts at 12 o\'clock and runs clockwise on a y-down screen', () => {
    const pts = ringArcPoints({ x: 0, y: 0, radius: 10 }, 0.25, 4);
    expect(pts).toHaveLength(2);
    expect(pts[0]?.x).toBeCloseTo(0);
    expect(pts[0]?.y).toBeCloseTo(-10);
    expect(pts[1]?.x).toBeCloseTo(10);
    expect(pts[1]?.y).toBeCloseTo(0);
  });
});
