import { describe, expect, it } from 'vitest';
import { createBank } from './bank';

const linear = (u: number) => u;
const SPRING = { stiffness: 170, damping: 26, mass: 1 };
/** A tween of progress alone, as a caller with its own `interpolate` gets. */
const U = { from: [0], to: [1] };

describe('createBank', () => {
  it('advances tweens sharing an easing on one voice, each by its own ms', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.tween({ id: 2, ms: 500, ease: linear, ...U });
    b.frame(250);
    expect(b.values(1)[0]).toBeCloseTo(0.25, 9);
    expect(b.values(2)[0]).toBeCloseTo(0.5, 9);
  });

  it('starts a tween at the bank time it was added, not at zero', () => {
    const b = createBank();
    b.frame(400);
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.frame(100);
    expect(b.values(1)[0]).toBeCloseTo(0.1, 9);
  });

  it('keeps a stopped subject out of the next frame and its neighbors running', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.tween({ id: 2, ms: 1000, ease: linear, ...U });
    b.frame(100);
    b.stop(1);
    b.frame(100);
    expect(b.values(2)[0]).toBeCloseTo(0.2, 9);
    expect(() => b.values(1)).toThrow(/no subject 1/);
  });

  it('solo at rate 0 freezes one tween and not its neighbor', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.tween({ id: 2, ms: 1000, ease: linear, ...U });
    b.frame(300);
    b.solo(1, 0);
    b.frame(300);
    expect(b.values(1)[0]).toBeCloseTo(0.3, 9);
    expect(b.values(2)[0]).toBeCloseTo(0.6, 9);
  });

  it('solo at rate 2 runs one tween at double speed from where it was', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.frame(200);
    b.solo(1, 2);
    b.frame(100);
    expect(b.values(1)[0]).toBeCloseTo(0.4, 9);
  });

  it('moves a tween of several axes between its own endpoints', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, from: [0, 100], to: [10, 0] });
    b.tween({ id: 2, ms: 1000, ease: linear, from: [5, 5], to: [5, 15] });
    b.frame(500);
    expect(Array.from(b.values(1))).toEqual([5, 50]);
    expect(Array.from(b.values(2))).toEqual([5, 10]);
  });

  it('moves a spring and keeps its velocity through a retarget', () => {
    const b = createBank();
    b.spring({ id: 1, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    b.frame(100);
    const before = b.motion(1);
    b.retarget(1, [0]);
    b.frame(0);
    expect(b.motion(1).velocity[0]).toBeCloseTo(before.velocity[0]!, 9);
  });

  it('decays toward rest with no target', () => {
    const b = createBank();
    b.spring({ id: 1, axes: 1, from: [0], to: null, velocity: [100], stiffness: 0, damping: 2, mass: 1 });
    b.frame(1000);
    const m = b.motion(1);
    expect(m.value[0]).toBeGreaterThan(0);
    expect(Math.abs(m.velocity[0]!)).toBeLessThan(100);
  });
});
