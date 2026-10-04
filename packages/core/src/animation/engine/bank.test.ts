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

describe('createBank membership', () => {
  it('leaves a neighbor its value when a subject stops mid-frame', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.tween({ id: 2, ms: 1000, ease: linear, ...U });
    b.tween({ id: 3, ms: 1000, ease: linear, from: [0], to: [2] });
    b.frame(100);
    b.stop(1);
    expect(b.values(2)[0]).toBeCloseTo(0.1, 9);
    expect(b.values(3)[0]).toBeCloseTo(0.2, 9);
  });

  it('answers a tween no frame has read with its own from', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.frame(100);
    b.tween({ id: 2, ms: 1000, ease: linear, from: [7], to: [9] });
    expect(Array.from(b.values(2))).toEqual([7]);
    expect(b.values(1)[0]).toBeCloseTo(0.1, 9);
  });

  it('starts and stops 10,000 tweens quickly', () => {
    const b = createBank();
    const n = 10_000;
    let t0 = performance.now();
    for (let i = 0; i < n; i++) b.tween({ id: i, ms: 1000, ease: linear, ...U });
    const started = performance.now() - t0;
    b.frame(16);
    t0 = performance.now();
    for (let i = 0; i < n; i++) b.stop(i);
    const stopped = performance.now() - t0;
    expect(started).toBeLessThan(200);
    expect(stopped).toBeLessThan(200);
  });

  it('retires a voice once no subject is left on it', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 100, ease: (u) => u, ...U });
    b.frame(100);
    expect(b.voiceCount()).toBe(1);
    b.stop(1);
    b.frame(16);
    expect(b.voiceCount()).toBe(0);
    b.tween({ id: 2, ms: 100, ease: (u) => u * u, ...U });
    b.frame(50);
    expect(b.values(2)[0]).toBeCloseTo(0.25, 9);
  });
});

describe('createBank joining a running voice', () => {
  it('starts a tween on a shared voice at the bank time it was added', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.frame(400);
    b.tween({ id: 2, ms: 1000, ease: linear, ...U });
    b.frame(100);
    expect(b.values(2)[0]).toBeCloseTo(0.1, 9);
  });

  it('starts a spring on a shared voice where a fresh bank would', () => {
    const start = { id: 2, axes: 1, from: [0], to: [10], velocity: [30], ...SPRING };
    const late = createBank();
    late.spring({ ...start, id: 1 });
    late.frame(1000);
    late.spring(start);
    late.frame(100);
    const fresh = createBank();
    fresh.spring(start);
    fresh.frame(100);
    expect(late.motion(2).value[0]).toBeCloseTo(fresh.motion(2).value[0]!, 9);
    expect(late.motion(2).velocity[0]).toBeCloseTo(fresh.motion(2).velocity[0]!, 9);
  });

  it('starts a glide on a shared voice where a fresh bank would', () => {
    const start = { id: 2, axes: 1, from: [0], to: null, velocity: [100], stiffness: 0, damping: 2, mass: 1 };
    const late = createBank();
    late.spring({ ...start, id: 1 });
    late.frame(1000);
    late.spring(start);
    late.frame(100);
    const fresh = createBank();
    fresh.spring(start);
    fresh.frame(100);
    expect(late.motion(2).value[0]).toBeCloseTo(fresh.motion(2).value[0]!, 9);
  });
});

describe('createBank springs', () => {
  it('answers motion before any frame from where the spring starts', () => {
    const b = createBank();
    b.spring({ id: 1, axes: 2, from: [1, 2], to: [10, 10], velocity: [3, 4], ...SPRING });
    expect(b.motion(1)).toEqual({ value: [1, 2], velocity: [3, 4] });
  });

  it('solos a spring no frame has read and holds it at rate 0', () => {
    const b = createBank();
    b.spring({ id: 1, axes: 1, from: [1], to: [10], velocity: [0], ...SPRING });
    b.solo(1, 0);
    b.frame(500);
    expect(b.motion(1).value[0]).toBeCloseTo(1, 9);
  });

  it('solos a moving spring without a jump and holds it at rate 0', () => {
    const b = createBank();
    b.spring({ id: 1, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    b.spring({ id: 2, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    b.frame(100);
    const before = b.motion(1);
    b.solo(1, 0);
    b.frame(300);
    expect(b.motion(1).value[0]).toBeCloseTo(before.value[0]!, 9);
    expect(b.motion(2).value[0]).toBeGreaterThan(before.value[0]!);
  });

  it('push sets a spring moving', () => {
    const b = createBank();
    b.spring({ id: 1, axes: 1, from: [0], to: [0], velocity: [0], ...SPRING });
    b.frame(16);
    b.push(1, [50]);
    b.frame(0);
    expect(b.motion(1).velocity[0]).toBeCloseTo(50, 9);
    b.frame(50);
    expect(b.motion(1).value[0]).toBeGreaterThan(0);
  });

  it("does not change the caller's start when retargeted", () => {
    const b = createBank();
    const s = { id: 1, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING };
    b.spring(s);
    b.frame(16);
    b.retarget(1, [20]);
    expect(s.to).toEqual([10]);
  });

  it('refuses to retarget a tween', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    expect(() => b.retarget(1, [2])).toThrow('bank: subject 1 is a tween; tweens are not retargeted');
  });

  it('lets a held spring coast from its motion when its target is cleared', () => {
    const b = createBank();
    b.spring({ id: 1, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    b.frame(50);
    const before = b.motion(1);
    b.retarget(1, null);
    b.frame(0);
    expect(b.motion(1).velocity[0]).toBeCloseTo(before.velocity[0]!, 9);
    b.frame(3000);
    const tau = SPRING.mass / SPRING.damping;
    expect(b.motion(1).value[0]).toBeCloseTo(before.value[0]! + before.velocity[0]! * tau, 3);
    expect(b.motion(1).velocity[0]).toBeCloseTo(0, 3);
  });

  it('sends a coasting spring to a target it is given', () => {
    const b = createBank();
    b.spring({ id: 1, axes: 1, from: [0], to: null, velocity: [100], ...SPRING });
    b.frame(50);
    const before = b.motion(1);
    b.retarget(1, [50]);
    b.frame(0);
    expect(b.motion(1).velocity[0]).toBeCloseTo(before.velocity[0]!, 9);
    b.frame(3000);
    expect(b.motion(1).value[0]).toBeCloseTo(50, 3);
  });

  it('keeps a solo spring solo, at its rate, across a retarget', () => {
    const b = createBank();
    b.spring({ id: 1, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    b.frame(50);
    b.solo(1, 0);
    const before = b.motion(1);
    b.retarget(1, null);
    b.frame(500);
    expect(b.motion(1).value[0]).toBeCloseTo(before.value[0]!, 9);
    expect(b.voiceCount()).toBe(1);
  });
});

describe('createBank reusing ids and voices', () => {
  it('restarts an id in the frame it was stopped', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.tween({ id: 2, ms: 1000, ease: linear, ...U });
    b.frame(500);
    b.stop(1);
    b.tween({ id: 1, ms: 1000, ease: linear, from: [0], to: [10] });
    b.frame(100);
    expect(b.values(1)[0]).toBeCloseTo(1, 9);
    expect(b.values(2)[0]).toBeCloseTo(0.6, 9);
  });

  it('returns a spring to a shared voice it left, from where it is', () => {
    const b = createBank();
    b.spring({ id: 1, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    b.spring({ id: 2, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    b.frame(50);
    b.retarget(1, null);
    b.frame(50);
    const before = b.motion(1);
    b.retarget(1, [-10]);
    b.frame(0);
    expect(b.motion(1).value[0]).toBeCloseTo(before.value[0]!, 9);
    expect(b.motion(1).velocity[0]).toBeCloseTo(before.velocity[0]!, 9);
    b.frame(3000);
    expect(b.motion(1).value[0]).toBeCloseTo(-10, 3);
  });
});

describe('createBank solo', () => {
  it('changes only the rate on a second solo', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.frame(200);
    b.solo(1, 0);
    b.frame(100);
    expect(b.values(1)[0]).toBeCloseTo(0.2, 9);
    expect(b.voiceCount()).toBe(1);
    b.solo(1, 1);
    b.frame(100);
    expect(b.values(1)[0]).toBeCloseTo(0.3, 9);
    expect(b.voiceCount()).toBe(1);
  });
});
