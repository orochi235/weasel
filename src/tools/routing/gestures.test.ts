import { describe, it, expect } from 'vitest';
import { GESTURE_DESCRIPTORS, getGestureDescriptor, type GestureName } from './gestures';

describe('GESTURE_DESCRIPTORS', () => {
  it('declares every gesture name exactly once', () => {
    const names = GESTURE_DESCRIPTORS.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('click has a target slot and no arg', () => {
    const d = getGestureDescriptor('click');
    expect(d.hasTarget).toBe(true);
    expect(d.arg).toBeUndefined();
  });

  it('wheel has no target and a direction arg with default "*"', () => {
    const d = getGestureDescriptor('wheel');
    expect(d.hasTarget).toBe(false);
    expect(d.arg?.name).toBe('direction');
    expect(d.arg?.values).toEqual(['up', 'down', '*']);
    expect(d.arg?.default).toBe('*');
  });

  it('keyDown has no target and a free-form key arg', () => {
    const d = getGestureDescriptor('keyDown');
    expect(d.hasTarget).toBe(false);
    expect(d.arg?.name).toBe('key');
    expect(d.arg?.values).toBe('free');
  });

  it('contextMenu has a target slot and no arg', () => {
    const d = getGestureDescriptor('contextMenu');
    expect(d.hasTarget).toBe(true);
    expect(d.arg).toBeUndefined();
  });

  it('multiTouchTap has no target and an enumerated fingers arg', () => {
    const d = getGestureDescriptor('multiTouchTap');
    expect(d.hasTarget).toBe(false);
    expect(d.arg?.name).toBe('fingers');
    expect(d.arg?.values).toEqual(['2', '3', '4']);
  });

  it('drag is a special case: target slot, but function-form drops it (no arg)', () => {
    const d = getGestureDescriptor('drag');
    expect(d.hasTarget).toBe(true);
    expect(d.arg).toBeUndefined();
  });

  it('getGestureDescriptor throws on unknown name', () => {
    expect(() => getGestureDescriptor('bogus' as GestureName)).toThrow(/unknown gesture/i);
  });
});
