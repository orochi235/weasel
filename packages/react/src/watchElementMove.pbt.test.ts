/**
 * Stateful property test of `watchElementMove` against fake observers that follow the spec's delivery rules:
 * an `IntersectionObserver` reporting its first measurement and then each change of threshold index or of
 * intersecting, against the root margin it was built with, and a `ResizeObserver` reporting each new size. The
 * box translates, resizes, collapses, and comes back inside the viewport while the observers deliver in turns.
 * Every report names a box that changed since the last; a translation of a pixel or more is reported within a
 * few turns; stopping disconnects everything and nothing is reported after.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { watchElementMove } from './watchElementMove';
import { runs, tally, timeoutFor } from './pbt.fixture';

const W = 800;
const H = 600;

interface Box { left: number; top: number; width: number; height: number }

const rect = (b: Box): DOMRectReadOnly => ({
  left: b.left, top: b.top, width: b.width, height: b.height, x: b.left, y: b.top,
  right: b.left + b.width, bottom: b.top + b.height, toJSON: () => b,
} as DOMRectReadOnly);

/** The fake world: one element's box, and the observers watching it, delivered by `turn`. */
function world(start: Box) {
  let box = start;
  const ios = new Set<FakeIO>();
  const ros = new Set<FakeRO>();
  let built = 0;

  class FakeIO {
    readonly root: { top: number; right: number; bottom: number; left: number };
    readonly threshold: number;
    last: { index: number; hit: boolean } | null = null;
    watching = false;
    constructor(readonly cb: IntersectionObserverCallback, opts: IntersectionObserverInit) {
      const [t, r, b, l] = opts.rootMargin!.split(' ').map((m) => -Number.parseFloat(m));
      this.root = { top: t!, right: W - r!, bottom: H - b!, left: l! };
      this.threshold = opts.threshold as number;
      built++;
    }
    observe() { this.watching = true; ios.add(this); }
    disconnect() { this.watching = false; ios.delete(this); }
    deliver() {
      const ix = Math.max(0, Math.min(box.left + box.width, this.root.right) - Math.max(box.left, this.root.left));
      const iy = Math.max(0, Math.min(box.top + box.height, this.root.bottom) - Math.max(box.top, this.root.top));
      const hit = box.left <= this.root.right && box.left + box.width >= this.root.left
        && box.top <= this.root.bottom && box.top + box.height >= this.root.top;
      const area = box.width * box.height;
      const ratio = area > 0 ? (ix * iy) / area : hit ? 1 : 0;
      const index = ratio >= this.threshold ? 1 : 0;
      if (this.last && this.last.index === index && this.last.hit === hit) return;
      this.last = { index, hit };
      this.cb([{ intersectionRatio: ratio, boundingClientRect: rect(box), isIntersecting: hit } as IntersectionObserverEntry], this as never);
    }
  }

  class FakeRO {
    size: string | null = '0x0';
    constructor(readonly cb: ResizeObserverCallback) {}
    observe() { ros.add(this); }
    disconnect() { ros.delete(this); }
    deliver() {
      const now = `${box.width}x${box.height}`;
      if (now === this.size) return;
      this.size = now;
      this.cb([], this as never);
    }
  }

  const element = document.createElement('div');
  element.getBoundingClientRect = () => rect(box) as DOMRect;
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => W });
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, get: () => H });
  vi.stubGlobal('IntersectionObserver', FakeIO);
  vi.stubGlobal('ResizeObserver', FakeRO);

  return {
    element,
    get box() { return box; },
    set box(b: Box) { box = b; },
    live: () => ios.size + ros.size,
    built: () => built,
    turn() {
      for (const o of [...ios]) if (o.watching) o.deliver();
      for (const o of [...ros]) if (ros.has(o)) o.deliver();
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const step = fc.oneof(
  { weight: 4, arbitrary: fc.record({ op: fc.constant('move' as const), dx: fc.oneof(fc.integer({ min: -40, max: 40 }), fc.double({ min: -3, max: 3, noNaN: true })), dy: fc.oneof(fc.integer({ min: -40, max: 40 }), fc.double({ min: -3, max: 3, noNaN: true })) }) },
  { weight: 1, arbitrary: fc.record({ op: fc.constant('resize' as const), dw: fc.integer({ min: -20, max: 20 }), dh: fc.integer({ min: -20, max: 20 }) }) },
  { weight: 1, arbitrary: fc.constant({ op: 'collapse' as const }) },
  { weight: 4, arbitrary: fc.record({ op: fc.constant('turns' as const), n: fc.integer({ min: 1, max: 3 }) }) },
  { weight: 1, arbitrary: fc.constant({ op: 'wait' as const }) },
);

const clampBox = (b: Box): Box => {
  const width = Math.max(0, Math.min(W / 2, b.width));
  const height = Math.max(0, Math.min(H / 2, b.height));
  return { width, height, left: Math.max(0, Math.min(W - width, b.left)), top: Math.max(0, Math.min(H - height, b.top)) };
};
const same = (a: Box, b: Box) => a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
/** How many turns a translation may take to be reported: one to deliver the frame it lands in, one to spare. */
const WITHIN = 2;

describe('watchElementMove against spec-following observers', () => {
  it('reports only real changes, every translation of a pixel or more, and nothing once stopped', () => {
    const seen = tally();
    const start = fc.record({
      left: fc.double({ min: 0, max: 600, noNaN: true }), top: fc.double({ min: 0, max: 400, noNaN: true }),
      width: fc.integer({ min: 1, max: 200 }), height: fc.integer({ min: 1, max: 150 }),
    });
    fc.assert(fc.property(start, fc.array(step, { minLength: 4, maxLength: 25 }), (b0, steps) => {
      vi.useFakeTimers();
      const w = world(clampBox(b0));
      let reportedAt = w.box;
      let reports = 0;
      let owed: { since: number; turns: number } | null = null;
      const stop = watchElementMove(w.element, () => {
        expect(same(w.box, reportedAt)).toBe(false);
        reportedAt = w.box;
        reports++;
        owed = null;
      });
      for (const s of steps) {
        if (s.op === 'move') {
          const next = clampBox({ ...w.box, left: w.box.left + s.dx, top: w.box.top + s.dy });
          const far = Math.abs(next.left - reportedAt.left) >= 1 || Math.abs(next.top - reportedAt.top) >= 1;
          const kept = next.width === reportedAt.width && next.height === reportedAt.height && next.width * next.height > 0;
          w.box = next;
          if (far && kept) {
            seen.add('owed');
            owed ??= { since: reports, turns: 0 };
          } else owed = null;
        } else if (s.op === 'resize') {
          w.box = clampBox({ ...w.box, width: w.box.width + s.dw, height: w.box.height + s.dh });
          owed = null;
        } else if (s.op === 'collapse') {
          seen.add('collapse');
          w.box = { ...w.box, width: 0 };
          owed = null;
        } else if (s.op === 'wait') {
          vi.advanceTimersByTime(1000);
        } else {
          for (let i = 0; i < s.n; i++) {
            w.turn();
            if (owed) owed.turns++;
            expect(owed === null || owed.turns <= WITHIN, 'a translation went unreported').toBe(true);
          }
        }
        expect(w.built()).toBeLessThan(10 * (steps.length + 2));
      }
      if (reports > 0) seen.add('reported');
      stop();
      expect(w.live()).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
      const after = reports;
      w.box = clampBox({ ...w.box, left: w.box.left + 50, width: w.box.width + 5 });
      w.turn();
      vi.advanceTimersByTime(2000);
      expect(reports).toBe(after);
      vi.useRealTimers();
    }), runs(200));
    for (const k of ['owed', 'collapse', 'reported']) expect(seen.get(k), k).toBeGreaterThan(30);
  }, timeoutFor(200, 10));
});
