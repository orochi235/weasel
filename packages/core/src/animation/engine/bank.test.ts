import { describe, expect, it, vi } from 'vitest';
import { createBank, type Bank } from './bank';

/** Every mix the bank makes, so a test can see what blits keeps per subject. */
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
/** Subject `id`'s `n` axes as the last frame read them. */
const vals = (b: Bank, id: number, n: number): number[] =>
  Array.from({ length: n }, (_, i) => b.column(id)[b.offset(id) + i]!);

describe('createBank', () => {
  it('advances tweens with one easing, each by its own ms', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.tween({ id: 2, ms: 500, ease: linear, ...U });
    b.frame(250);
    expect(vals(b, 1, 1)[0]).toBeCloseTo(0.25, 9);
    expect(vals(b, 2, 1)[0]).toBeCloseTo(0.5, 9);
  });

  it('starts a tween at the bank time it was added, not at zero', () => {
    const b = createBank();
    b.frame(400);
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.frame(100);
    expect(vals(b, 1, 1)[0]).toBeCloseTo(0.1, 9);
  });

  it('keeps a stopped subject out of the next frame and its neighbors running', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.tween({ id: 2, ms: 1000, ease: linear, ...U });
    b.frame(100);
    b.stop(1);
    b.frame(100);
    expect(vals(b, 2, 1)[0]).toBeCloseTo(0.2, 9);
    expect(() => b.column(1)).toThrow(/no subject 1/);
    expect(() => b.offset(1)).toThrow(/no subject 1/);
  });

  it('rate 0 freezes one tween and not its neighbor', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.tween({ id: 2, ms: 1000, ease: linear, ...U });
    b.frame(300);
    b.rate(1, 0);
    b.frame(300);
    expect(vals(b, 1, 1)[0]).toBeCloseTo(0.3, 9);
    expect(vals(b, 2, 1)[0]).toBeCloseTo(0.6, 9);
  });

  it('rate 2 runs one tween at double speed from where it was', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.frame(200);
    b.rate(1, 2);
    b.frame(100);
    expect(vals(b, 1, 1)[0]).toBeCloseTo(0.4, 9);
  });

  it('moves a tween of several axes between its own endpoints', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, from: [0, 100], to: [10, 0] });
    b.tween({ id: 2, ms: 1000, ease: linear, from: [5, 5], to: [5, 15] });
    b.frame(500);
    expect(vals(b, 1, 2)).toEqual([5, 50]);
    expect(vals(b, 2, 2)).toEqual([5, 10]);
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
    expect(vals(b, 2, 1)[0]).toBeCloseTo(0.1, 9);
    expect(vals(b, 3, 1)[0]).toBeCloseTo(0.2, 9);
  });

  it('answers a tween no frame has read with its own from', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.frame(100);
    b.tween({ id: 2, ms: 1000, ease: linear, from: [7], to: [9] });
    expect(vals(b, 2, 1)).toEqual([7]);
    expect(vals(b, 1, 1)[0]).toBeCloseTo(0.1, 9);
  });

  it('starts and stops tweens in time linear in their number', () => {
    const phases = (n: number): [number, number] => {
      const b = createBank();
      let t0 = performance.now();
      for (let i = 0; i < n; i++) b.tween({ id: i, ms: 1000, ease: linear, ...U });
      const started = performance.now() - t0;
      b.frame(16);
      t0 = performance.now();
      for (let i = 0; i < n; i++) b.stop(i);
      return [started, performance.now() - t0];
    };
    const median = (n: number): [number, number] => {
      const runs = [phases(n), phases(n), phases(n)];
      const mid = (k: 0 | 1) => runs.map((r) => r[k]).sort((a, b) => a - b)[1]!;
      return [mid(0), mid(1)];
    };
    phases(1000);
    const [start1k, stop1k] = median(1000);
    const [start10k, stop10k] = median(10_000);
    expect(start10k).toBeLessThan(30 * start1k);
    expect(stop10k).toBeLessThan(30 * stop1k);
  });

  it('leaves nothing behind when a tween is refused', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 100, ease: linear, from: [0, 0], to: [1, 1] });
    expect(() => b.tween({ id: 2, ms: 100, ease: linear, from: [0, 0], to: [1] })).toThrow();
    expect(b.has(2)).toBe(false);
    b.frame(50);
    expect(vals(b, 1, 2)).toEqual([0.5, 0.5]);
  });

  it('runs tweens of different easings and axis counts side by side on their own voices', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, from: [0], to: [1] });
    b.tween({ id: 2, ms: 1000, ease: (u) => u * u, from: [10], to: [20] });
    b.tween({ id: 3, ms: 1000, ease: linear, from: [0, 100], to: [10, 0] });
    b.tween({ id: 4, ms: 1000, ease: (u) => u * u, from: [0, 0], to: [4, 8] });
    b.frame(500);
    expect(vals(b, 1, 1)[0]).toBeCloseTo(0.5, 9);
    expect(vals(b, 2, 1)[0]).toBeCloseTo(12.5, 9);
    expect(vals(b, 3, 2)).toEqual([5, 50]);
    expect(vals(b, 4, 2)).toEqual([1, 2]);
  });

  it('retires a mix once it has been empty at two frames running, and starts a fresh one after', () => {
    mixes.length = 0;
    const b = createBank();
    b.tween({ id: 1, ms: 100, ease: linear, ...U });
    b.frame(100);
    b.stop(1);
    b.frame(16);
    b.tween({ id: 2, ms: 100, ease: linear, ...U });
    b.frame(50);
    expect(mixes).toHaveLength(1);
    expect(vals(b, 2, 1)[0]).toBeCloseTo(0.5, 9);
    b.stop(2);
    b.frame(16);
    b.frame(16);
    b.tween({ id: 3, ms: 100, ease: linear, ...U });
    b.frame(25);
    expect(mixes).toHaveLength(2);
    expect(vals(b, 3, 1)[0]).toBeCloseTo(0.25, 9);
  });

  it('runs one voice per subject', () => {
    const b = createBank();
    for (let id = 1; id <= 50; id++) b.tween({ id, ms: 100, ease: linear, ...U });
    for (let id = 51; id <= 60; id++) b.spring({ id, axes: 2, from: [0, 0], to: [1, 1], velocity: [0, 0], ...SPRING });
    b.frame(16);
    expect(b.voiceCount()).toBe(60);
    b.stop(3);
    expect(b.voiceCount()).toBe(59);
  });

  it('lets its mix forget subjects that have stopped', () => {
    mixes.length = 0;
    const b = createBank();
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

describe('createBank joining a running mix', () => {
  it('starts a tween on a running mix at the bank time it was added', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.frame(400);
    b.tween({ id: 2, ms: 1000, ease: linear, ...U });
    b.frame(100);
    expect(vals(b, 2, 1)[0]).toBeCloseTo(0.1, 9);
  });

  it('starts a spring on a running mix where a fresh bank would', () => {
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

  it('starts a glide on a running mix where a fresh bank would', () => {
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

  it('holds a spring no frame has read at rate 0', () => {
    const b = createBank();
    b.spring({ id: 1, axes: 1, from: [1], to: [10], velocity: [0], ...SPRING });
    b.rate(1, 0);
    b.frame(500);
    expect(b.motion(1).value[0]).toBeCloseTo(1, 9);
  });

  it('holds a moving spring at rate 0 without a jump', () => {
    const b = createBank();
    b.spring({ id: 1, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    b.spring({ id: 2, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    b.frame(100);
    const before = b.motion(1);
    b.rate(1, 0);
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

  it('keeps a spring at its rate across a retarget', () => {
    const b = createBank();
    b.spring({ id: 1, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    b.frame(50);
    b.rate(1, 0);
    const before = b.motion(1);
    b.retarget(1, null);
    b.frame(500);
    expect(b.motion(1).value[0]).toBeCloseTo(before.value[0]!, 9);
    expect(b.voiceCount()).toBe(1);
  });
});

describe('createBank reusing ids', () => {
  it('restarts an id in the frame it was stopped', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.tween({ id: 2, ms: 1000, ease: linear, ...U });
    b.frame(500);
    b.stop(1);
    b.tween({ id: 1, ms: 1000, ease: linear, from: [0], to: [10] });
    b.frame(100);
    expect(vals(b, 1, 1)[0]).toBeCloseTo(1, 9);
    expect(vals(b, 2, 1)[0]).toBeCloseTo(0.6, 9);
  });

  it('switches a spring between held and free twice, from where it is', () => {
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

describe('createBank rate', () => {
  it('changes the rate again on a second call', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear, ...U });
    b.frame(200);
    b.rate(1, 0);
    b.frame(100);
    expect(vals(b, 1, 1)[0]).toBeCloseTo(0.2, 9);
    expect(b.voiceCount()).toBe(1);
    b.rate(1, 1);
    b.frame(100);
    expect(vals(b, 1, 1)[0]).toBeCloseTo(0.3, 9);
    expect(b.voiceCount()).toBe(1);
  });
});
