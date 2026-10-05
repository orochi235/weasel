import { describe, expect, it, vi } from 'vitest';
import { createCodec, type Reader } from './codec';

/** Every mix the codec makes, so a test can see what blits keeps per subject. */
const mixes = vi.hoisted(() => [] as unknown[]);
vi.mock('@msb235/blits', async (importOriginal) => {
  const blits = await importOriginal<typeof import('@msb235/blits')>();
  return {
    ...blits,
    mix: (...args: Parameters<typeof blits.mix>) => {
      const m = blits.mix(...args);
      mixes.push(m);
      return m;
    },
  };
});
/** Per-subject records a mix still holds. Reads blits' internals: it has no public count. */
const held = (m: unknown): number => {
  const x = m as { chains: { strong: Map<unknown, unknown> }; voices: { parted: Map<unknown, unknown> | null }[] };
  return x.chains.strong.size + x.voices.reduce((n, v) => n + (v.parted?.size ?? 0), 0);
};

const linear = (u: number) => u;
const SPRING = { stiffness: 170, damping: 26, mass: 1 };
/** A tween of progress alone, as a caller with its own `interpolate` gets. */
const U = { from: [0], to: [1] };
/** A subject's `n` axes as the last frame read them. */
const vals = (r: Reader, n: number): number[] =>
  Array.from({ length: n }, (_, i) => r.cols[r.at + i]!);

describe('createCodec', () => {
  it('advances tweens with one easing, each by its own ms', () => {
    const b = createCodec();
    const r1 = b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    const r2 = b.tween({ id: 2, ms: 500, ease: linear, ...U });
    b.frame(250);
    expect(vals(r1, 1)[0]).toBeCloseTo(0.25, 9);
    expect(vals(r2, 1)[0]).toBeCloseTo(0.5, 9);
  });

  it('starts a tween at the codec time it was added, not at zero', () => {
    const b = createCodec();
    b.frame(400);
    const r1 = b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.frame(100);
    expect(vals(r1, 1)[0]).toBeCloseTo(0.1, 9);
  });

  it('keeps a stopped subject out of the next frame and its neighbors running', () => {
    const b = createCodec();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    const r2 = b.tween({ id: 2, ms: 1000, ease: linear, ...U });
    b.frame(100);
    b.stop(1);
    b.frame(100);
    expect(vals(r2, 1)[0]).toBeCloseTo(0.2, 9);
    expect(b.has(1)).toBe(false);
  });

  it('drops a tween stopped before any frame, leaving no voice and its neighbor running', () => {
    const b = createCodec();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    const r2 = b.tween({ id: 2, ms: 1000, ease: linear, ...U });
    b.stop(1);
    b.frame(100);
    expect(b.has(1)).toBe(false);
    expect((mixes.at(-1) as { voices: unknown[] }).voices).toHaveLength(1);
    expect(vals(r2, 1)[0]).toBeCloseTo(0.1, 9);
  });

  it('applies a rate asked for before the first frame', () => {
    const b = createCodec();
    const r1 = b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.rate(1, 2);
    b.frame(100);
    expect(vals(r1, 1)[0]).toBeCloseTo(0.2, 9);
  });

  it('rate 0 freezes one tween and not its neighbor', () => {
    const b = createCodec();
    const r1 = b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    const r2 = b.tween({ id: 2, ms: 1000, ease: linear, ...U });
    b.frame(300);
    b.rate(1, 0);
    b.frame(300);
    expect(vals(r1, 1)[0]).toBeCloseTo(0.3, 9);
    expect(vals(r2, 1)[0]).toBeCloseTo(0.6, 9);
  });

  it('rate 2 runs one tween at double speed from where it was', () => {
    const b = createCodec();
    const r1 = b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.frame(200);
    b.rate(1, 2);
    b.frame(100);
    expect(vals(r1, 1)[0]).toBeCloseTo(0.4, 9);
  });

  it('moves a tween of several axes between its own endpoints', () => {
    const b = createCodec();
    const r1 = b.tween({ id: 1, ms: 1000, ease: linear, from: [0, 100], to: [10, 0] });
    const r2 = b.tween({ id: 2, ms: 1000, ease: linear, from: [5, 5], to: [5, 15] });
    b.frame(500);
    expect(vals(r1, 2)).toEqual([5, 50]);
    expect(vals(r2, 2)).toEqual([5, 10]);
  });

  it('moves a spring and keeps its velocity through a retarget', () => {
    const b = createCodec();
    const r1 = b.spring({ id: 1, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    b.frame(100);
    const before = r1.motion();
    b.retarget(1, [0]);
    b.frame(0);
    expect(r1.motion().velocity[0]).toBeCloseTo(before.velocity[0]!, 9);
  });

  it('decays toward rest with no target', () => {
    const b = createCodec();
    const r1 = b.spring({ id: 1, axes: 1, from: [0], to: null, velocity: [100], stiffness: 0, damping: 2, mass: 1 });
    b.frame(1000);
    const m = r1.motion();
    expect(m.value[0]).toBeGreaterThan(0);
    expect(Math.abs(m.velocity[0]!)).toBeLessThan(100);
  });
});

describe('createCodec readers', () => {
  it('reads its subject before the first frame, after a neighbor stops, and after a rebuild', () => {
    const b = createCodec();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    const r = b.tween({ id: 2, ms: 1000, ease: linear, from: [0, 10], to: [2, 20] });
    expect(vals(r, 2)).toEqual([0, 10]);
    b.frame(100);
    expect(vals(r, 2)[0]).toBeCloseTo(0.2, 9);
    b.stop(1);
    expect(vals(r, 2)[1]).toBeCloseTo(11, 9);
    b.tween({ id: 3, ms: 1000, ease: linear, from: [5, 5], to: [6, 6] });
    b.tween({ id: 4, ms: 1000, ease: linear, from: [7, 7], to: [8, 8] });
    b.frame(100);
    expect(vals(r, 2)[0]).toBeCloseTo(0.4, 9);
    expect(vals(r, 2)[1]).toBeCloseTo(12, 9);
  });

  it("reads a spring's motion before the first frame and after a neighbor stops", () => {
    const b = createCodec();
    b.spring({ id: 1, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    const r = b.spring({ id: 2, axes: 1, from: [1], to: [10], velocity: [3], ...SPRING });
    expect(r.motion()).toEqual({ value: [1], velocity: [3] });
    b.frame(100);
    const before = r.motion();
    b.stop(1);
    expect(r.motion()).toEqual(before);
    expect(vals(r, 1)[0]).toBeCloseTo(before.value[0]!, 9);
  });
});

describe('createCodec membership', () => {
  it('leaves a neighbor its value when a subject stops mid-frame', () => {
    const b = createCodec();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    const r2 = b.tween({ id: 2, ms: 1000, ease: linear, ...U });
    const r3 = b.tween({ id: 3, ms: 1000, ease: linear, from: [0], to: [2] });
    b.frame(100);
    b.stop(1);
    expect(vals(r2, 1)[0]).toBeCloseTo(0.1, 9);
    expect(vals(r3, 1)[0]).toBeCloseTo(0.2, 9);
  });

  it('answers a tween no frame has read with its own from', () => {
    const b = createCodec();
    const r1 = b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.frame(100);
    const r2 = b.tween({ id: 2, ms: 1000, ease: linear, from: [7], to: [9] });
    expect(vals(r2, 1)).toEqual([7]);
    expect(vals(r1, 1)[0]).toBeCloseTo(0.1, 9);
  });

  it('leaves nothing behind when a tween is refused', () => {
    const b = createCodec();
    const r1 = b.tween({ id: 1, ms: 100, ease: linear, from: [0, 0], to: [1, 1] });
    expect(() => b.tween({ id: 2, ms: 100, ease: linear, from: [0, 0], to: [1] })).toThrow();
    expect(b.has(2)).toBe(false);
    b.frame(50);
    expect(vals(r1, 2)).toEqual([0.5, 0.5]);
  });

  it('runs tweens of different easings and axis counts side by side on their own voices', () => {
    const b = createCodec();
    const r1 = b.tween({ id: 1, ms: 1000, ease: linear, from: [0], to: [1] });
    const r2 = b.tween({ id: 2, ms: 1000, ease: (u) => u * u, from: [10], to: [20] });
    const r3 = b.tween({ id: 3, ms: 1000, ease: linear, from: [0, 100], to: [10, 0] });
    const r4 = b.tween({ id: 4, ms: 1000, ease: (u) => u * u, from: [0, 0], to: [4, 8] });
    b.frame(500);
    expect(vals(r1, 1)[0]).toBeCloseTo(0.5, 9);
    expect(vals(r2, 1)[0]).toBeCloseTo(12.5, 9);
    expect(vals(r3, 2)).toEqual([5, 50]);
    expect(vals(r4, 2)).toEqual([1, 2]);
  });

  it('retires a mix once it has been empty at two frames running, and starts a fresh one after', () => {
    mixes.length = 0;
    const b = createCodec();
    b.tween({ id: 1, ms: 100, ease: linear, ...U });
    b.frame(100);
    b.stop(1);
    b.frame(16);
    const r2 = b.tween({ id: 2, ms: 100, ease: linear, ...U });
    b.frame(50);
    expect(mixes).toHaveLength(1);
    expect(vals(r2, 1)[0]).toBeCloseTo(0.5, 9);
    b.stop(2);
    b.frame(16);
    b.frame(16);
    const r3 = b.tween({ id: 3, ms: 100, ease: linear, ...U });
    b.frame(25);
    expect(mixes).toHaveLength(2);
    expect(vals(r3, 1)[0]).toBeCloseTo(0.25, 9);
  });

  it('runs one voice per subject', () => {
    const b = createCodec();
    for (let id = 1; id <= 50; id++) b.tween({ id, ms: 100, ease: linear, ...U });
    for (let id = 51; id <= 60; id++) b.spring({ id, axes: 2, from: [0, 0], to: [1, 1], velocity: [0, 0], ...SPRING });
    b.frame(16);
    expect(b.voiceCount()).toBe(60);
    b.stop(3);
    expect(b.voiceCount()).toBe(59);
  });

  it('lets its mix forget subjects that have stopped', () => {
    mixes.length = 0;
    const b = createCodec();
    b.tween({ id: 0, ms: 1e9, ease: linear, ...U });
    b.frame(16);
    for (let i = 1; i <= 2000; i++) {
      b.tween({ id: i, ms: 100, ease: linear, ...U });
      b.frame(16);
      b.stop(i);
    }
    b.frame(16);
    expect(mixes).toHaveLength(1);
    expect(held(mixes[0])).toBeLessThan(10);
    expect((mixes[0] as { voices: unknown[] }).voices.length).toBeLessThan(10);
  });
});

describe('createCodec joining a running mix', () => {
  it('starts a tween on a running mix at the codec time it was added', () => {
    const b = createCodec();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.frame(400);
    const r2 = b.tween({ id: 2, ms: 1000, ease: linear, ...U });
    b.frame(100);
    expect(vals(r2, 1)[0]).toBeCloseTo(0.1, 9);
  });

  it('starts a spring on a running mix where a fresh codec would', () => {
    const start = { id: 2, axes: 1, from: [0], to: [10], velocity: [30], ...SPRING };
    const late = createCodec();
    late.spring({ ...start, id: 1 });
    late.frame(1000);
    const lateR = late.spring(start);
    late.frame(100);
    const fresh = createCodec();
    const freshR = fresh.spring(start);
    fresh.frame(100);
    expect(lateR.motion().value[0]).toBeCloseTo(freshR.motion().value[0]!, 9);
    expect(lateR.motion().velocity[0]).toBeCloseTo(freshR.motion().velocity[0]!, 9);
  });

  it('starts a glide on a running mix where a fresh codec would', () => {
    const start = { id: 2, axes: 1, from: [0], to: null, velocity: [100], stiffness: 0, damping: 2, mass: 1 };
    const late = createCodec();
    late.spring({ ...start, id: 1 });
    late.frame(1000);
    const lateR = late.spring(start);
    late.frame(100);
    const fresh = createCodec();
    const freshR = fresh.spring(start);
    fresh.frame(100);
    expect(lateR.motion().value[0]).toBeCloseTo(freshR.motion().value[0]!, 9);
  });
});

describe('createCodec springs', () => {
  it('answers motion before any frame from where the spring starts', () => {
    const b = createCodec();
    const r1 = b.spring({ id: 1, axes: 2, from: [1, 2], to: [10, 10], velocity: [3, 4], ...SPRING });
    expect(r1.motion()).toEqual({ value: [1, 2], velocity: [3, 4] });
  });

  it('holds a spring no frame has read at rate 0', () => {
    const b = createCodec();
    const r1 = b.spring({ id: 1, axes: 1, from: [1], to: [10], velocity: [0], ...SPRING });
    b.rate(1, 0);
    b.frame(500);
    expect(r1.motion().value[0]).toBeCloseTo(1, 9);
  });

  it('holds a moving spring at rate 0 without a jump', () => {
    const b = createCodec();
    const r1 = b.spring({ id: 1, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    const r2 = b.spring({ id: 2, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    b.frame(100);
    const before = r1.motion();
    b.rate(1, 0);
    b.frame(300);
    expect(r1.motion().value[0]).toBeCloseTo(before.value[0]!, 9);
    expect(r2.motion().value[0]).toBeGreaterThan(before.value[0]!);
  });

  it('push sets a spring moving', () => {
    const b = createCodec();
    const r1 = b.spring({ id: 1, axes: 1, from: [0], to: [0], velocity: [0], ...SPRING });
    b.frame(16);
    b.push(1, [50]);
    b.frame(0);
    expect(r1.motion().velocity[0]).toBeCloseTo(50, 9);
    b.frame(50);
    expect(r1.motion().value[0]).toBeGreaterThan(0);
  });

  it("does not change the caller's start when retargeted", () => {
    const b = createCodec();
    const s = { id: 1, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING };
    b.spring(s);
    b.frame(16);
    b.retarget(1, [20]);
    expect(s.to).toEqual([10]);
  });

  it('refuses to retarget a tween', () => {
    const b = createCodec();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    expect(() => b.retarget(1, [2])).toThrow('codec: subject 1 is a tween; tweens are not retargeted');
  });

  it('lets a held spring coast from its motion when its target is cleared', () => {
    const b = createCodec();
    const r1 = b.spring({ id: 1, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    b.frame(50);
    const before = r1.motion();
    b.retarget(1, null);
    b.frame(0);
    expect(r1.motion().velocity[0]).toBeCloseTo(before.velocity[0]!, 9);
    b.frame(3000);
    const tau = SPRING.mass / SPRING.damping;
    expect(r1.motion().value[0]).toBeCloseTo(before.value[0]! + before.velocity[0]! * tau, 3);
    expect(r1.motion().velocity[0]).toBeCloseTo(0, 3);
  });

  it('sends a coasting spring to a target it is given', () => {
    const b = createCodec();
    const r1 = b.spring({ id: 1, axes: 1, from: [0], to: null, velocity: [100], ...SPRING });
    b.frame(50);
    const before = r1.motion();
    b.retarget(1, [50]);
    b.frame(0);
    expect(r1.motion().velocity[0]).toBeCloseTo(before.velocity[0]!, 9);
    b.frame(3000);
    expect(r1.motion().value[0]).toBeCloseTo(50, 3);
  });

  it('keeps a spring at its rate across a retarget', () => {
    const b = createCodec();
    const r1 = b.spring({ id: 1, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    b.frame(50);
    b.rate(1, 0);
    const before = r1.motion();
    b.retarget(1, null);
    b.frame(500);
    expect(r1.motion().value[0]).toBeCloseTo(before.value[0]!, 9);
    expect(b.voiceCount()).toBe(1);
  });
});

describe('createCodec reusing ids', () => {
  it('restarts an id in the frame it was stopped', () => {
    const b = createCodec();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    const r2 = b.tween({ id: 2, ms: 1000, ease: linear, ...U });
    b.frame(500);
    b.stop(1);
    const again = b.tween({ id: 1, ms: 1000, ease: linear, from: [0], to: [10] });
    b.frame(100);
    expect(vals(again, 1)[0]).toBeCloseTo(1, 9);
    expect(vals(r2, 1)[0]).toBeCloseTo(0.6, 9);
  });

  it('switches a spring between held and free twice, from where it is', () => {
    const b = createCodec();
    const r1 = b.spring({ id: 1, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    b.spring({ id: 2, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    b.frame(50);
    b.retarget(1, null);
    b.frame(50);
    const before = r1.motion();
    b.retarget(1, [-10]);
    b.frame(0);
    expect(r1.motion().value[0]).toBeCloseTo(before.value[0]!, 9);
    expect(r1.motion().velocity[0]).toBeCloseTo(before.velocity[0]!, 9);
    b.frame(3000);
    expect(r1.motion().value[0]).toBeCloseTo(-10, 3);
  });
});

describe('createCodec rate', () => {
  it('changes the rate again on a second call', () => {
    const b = createCodec();
    const r1 = b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.frame(200);
    b.rate(1, 0);
    b.frame(100);
    expect(vals(r1, 1)[0]).toBeCloseTo(0.2, 9);
    expect(b.voiceCount()).toBe(1);
    b.rate(1, 1);
    b.frame(100);
    expect(vals(r1, 1)[0]).toBeCloseTo(0.3, 9);
    expect(b.voiceCount()).toBe(1);
  });
});
