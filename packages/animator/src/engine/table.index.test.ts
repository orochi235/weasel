import { describe, expect, it } from 'vitest';
import { AnimatorEventHub } from '../observe';
import { createTarget, stateOf } from '../target';
import { createAnimatorCore } from './core';
import type { ActiveAnimation, AnimationSeed } from './context';
import { createTable } from './table';

function rig() {
  const table = createTable({
    codec: { stop() {}, has: () => false, rate() {} },
    hub: new AnimatorEventHub(),
    elapsed: () => 0,
    direction: () => 1,
    seedClock() {},
    showNow() {},
    resting: () => false,
    framing: () => false,
    requestFrame() {},
  });
  let nextId = 1;
  const start = (more: Partial<AnimationSeed> = {}) => table.register({ id: nextId++, kind: 'tween', tick: () => false, ...more });
  const ids = (as: Iterable<ActiveAnimation>): number[] => [...as].map((a) => a.id);
  return { table, start, ids };
}

/** Counts walks over the whole table from here on. A walk is what costs more as more run, and
 *  jsdom has no clock fine enough to show it, so the count stands in for the time. */
function countWalks(animations: Map<number, unknown>): () => number {
  let walks = 0;
  const count = <F extends (...args: never[]) => unknown>(f: F): F =>
    ((...args: never[]) => { walks += 1; return f.apply(animations, args); }) as F;
  animations.values = count(animations.values);
  animations.entries = count(animations.entries);
  animations.keys = count(animations.keys);
  animations.forEach = count(animations.forEach);
  animations[Symbol.iterator] = count(animations[Symbol.iterator]);
  return () => walks;
}

describe('the table finds animations by key and by target', () => {
  it('answers the animations under a key in the order they registered', () => {
    const r = rig();
    r.start({ cancelKey: 'a' });
    r.start({ cancelKey: 'b' });
    r.start({ cancelKey: 'a', keepExisting: true });
    r.start();
    expect(r.ids(r.table.under('a'))).toEqual([1, 3]);
    expect(r.ids(r.table.under('b'))).toEqual([2]);
    expect(r.ids(r.table.under('none'))).toEqual([]);
  });

  it('forgets one as it leaves, however it leaves', () => {
    const r = rig();
    const a = r.start({ cancelKey: 'k' });
    r.start({ cancelKey: 'k', keepExisting: true });
    r.start({ cancelKey: 'k', keepExisting: true });
    a.cancel();
    r.table.finish(2);
    expect(r.ids(r.table.under('k'))).toEqual([3]);
    r.table.cancelAll(() => {});
    expect(r.ids(r.table.under('k'))).toEqual([]);
  });

  it('interrupts whoever holds a key without walking the table', () => {
    const r = rig();
    for (let i = 0; i < 50; i++) r.start({ cancelKey: `k${i}` });
    const walks = countWalks(r.table.animations);
    r.start({ cancelKey: 'k7' });
    r.table.cancelByKey('k9');
    expect(walks()).toBe(0);
    expect(r.table.animations.size).toBe(49);
    expect(r.ids(r.table.under('k7'))).toEqual([51]);
  });

  it('answers the animations on a target', () => {
    const r = rig();
    const s = stateOf(createTarget<number>({ get: () => 0, set: () => {} }));
    const other = stateOf(createTarget<number>({ get: () => 0, set: () => {} }));
    r.start({ target: s as never });
    r.start({ target: other as never });
    const third = r.start({ target: s as never });
    expect(r.ids(r.table.on(s as never))).toEqual([1, 3]);
    third.cancel();
    expect(r.ids(r.table.on(s as never))).toEqual([1]);
    expect(r.ids(r.table.on(other as never))).toEqual([2]);
  });
});

describe('an animator with many animations running', () => {
  function mount() {
    let now = 0;
    const core = createAnimatorCore({
      now: () => now,
      requestFrame() {},
      cancelFrame() {},
      tripwire: () => false,
      colorOverrides: {} as never,
    });
    const box = (v = 0) => {
      const b = { v };
      return { b, target: createTarget<number>({ get: () => b.v, set: (x) => { b.v = x; } }) };
    };
    return { api: core.api, box, frame: (dt: number) => { now += dt; core.tick(now); } };
  }

  it('stops a target, and asks about and paces a key, by going to their animations alone', () => {
    const m = mount();
    const boxes = Array.from({ length: 20 }, () => m.box());
    boxes.forEach((x, i) => m.api.tween({ target: x.target, to: 100, ms: 1000, cancelKey: `k${i}`, easing: (u) => u }));
    m.frame(0);
    m.frame(500);
    // The core holds the same map the API walks; reach it through `live()`'s source of truth.
    const sizes = () => m.api.live().length;
    expect(sizes()).toBe(20);
    boxes[3]!.target.stop();
    expect(boxes[3]!.b.v).toBeCloseTo(50, 6);
    expect(m.api.isActive('k3')).toBe(false);
    expect(m.api.isActive('k4')).toBe(true);
    m.api.pauseKey('k4');
    m.frame(250);
    expect(boxes[4]!.target.read()).toBeCloseTo(50, 6);
    expect(boxes[5]!.target.read()).toBeCloseTo(75, 6);
    m.api.cancelKey('k5');
    expect(boxes[5]!.b.v).toBeCloseTo(75, 6);
    expect(sizes()).toBe(18);
  });

  it('starts a spring at the velocity of what it interrupts under its key', () => {
    const m = mount();
    const x = m.box();
    m.api.spring({ target: x.target, to: 100, cancelKey: 'k', stiffness: 100, damping: 10 });
    m.frame(0);
    m.frame(100);
    const before = x.target.read();
    m.api.spring({ target: x.target, to: 100, cancelKey: 'k', stiffness: 100, damping: 10 });
    m.frame(16);
    // Still moving the way it was: it did not start over at rest.
    expect(x.target.read() - before).toBeGreaterThan(0.5);
  });
});
