/**
 * The timeline on a real hosted animator: event crossings counted against the laps played, whatever
 * the frames; sampled values read where the playhead stands; and a seek that lands the same
 * wherever playback had been before it.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { clocked, runs, tally, timeoutFor } from '../pbt.fixture';
import { sampleTrack } from './sampleTrack';
import type { EventTrack, SampledTrack, TimelineHandle, Track } from './types';

const RUNS = 150;

interface Plan {
  /** Event times on the root's event track. */
  events: number[];
  /** A nested timeline's start and event times, and its own duration if it states one. */
  nested: { at: number; events: number[]; duration?: number } | null;
  /** The sampled track's keys, as (time, value) pairs on a whole-ms grid. */
  keys: [number, number][];
  duration?: number;
}

const ms = fc.integer({ min: 0, max: 400 });
const plan: fc.Arbitrary<Plan> = fc.record({
  events: fc.array(fc.oneof(ms, fc.integer({ min: -20, max: 0 })), { maxLength: 6 }).map((a) => a.sort((x, y) => x - y)),
  nested: fc.option(fc.record({
    at: fc.integer({ min: 0, max: 200 }),
    events: fc.array(ms, { minLength: 1, maxLength: 4 }).map((a) => a.sort((x, y) => x - y)),
    duration: fc.option(fc.integer({ min: 0, max: 300 }), { nil: undefined }),
  }, { requiredKeys: ['at', 'events'] }), { nil: null }),
  keys: fc.array(fc.tuple(ms, fc.integer({ min: -100, max: 100 })), { minLength: 1, maxLength: 5 })
    .map((a) => [...a, [400, 7] as [number, number]].sort((x, y) => x[0] - y[0])),
  duration: fc.option(fc.integer({ min: 1, max: 500 }), { nil: undefined }),
}, { requiredKeys: ['events', 'nested', 'keys'] });

interface Built {
  tracks: Track[];
  sampled: SampledTrack<number>;
  fired: { id: string; late: number }[];
  ticks: number[];
  /** Each event id with the root time it sits at. */
  times: Map<string, number>;
}

function build(p: Plan): Built {
  const fired: Built['fired'] = [];
  const ticks: number[] = [];
  const times = new Map<string, number>();
  const evTrack = (ts: number[], prefix: string, at: number): EventTrack => ({
    kind: 'event',
    events: ts.map((t, i) => {
      const id = `${prefix}${i}`;
      times.set(id, t + at);
      return { t, fire: (late) => { fired.push({ id, late }); } };
    }),
  });
  const sampled: SampledTrack<number> = {
    kind: 'sampled',
    keys: p.keys.map(([t, value]) => ({ t, value })),
    onTick: (v) => { ticks.push(v); },
  };
  const tracks: Track[] = [evTrack(p.events, 'r', 0), sampled];
  if (p.nested) {
    tracks.push({
      kind: 'timeline',
      at: p.nested.at,
      timeline: { tracks: [evTrack(p.nested.events, 'n', 0)], ...(p.nested.duration === undefined ? {} : { duration: p.nested.duration }) },
    });
    for (const [id, t] of times) if (id.startsWith('n')) times.set(id, t + p.nested.at);
  }
  return { tracks, sampled, fired, ticks, times };
}

/** Whether event `id` is ever reached: within its nested timeline's own duration and the root's. */
function reachable(p: Plan, id: string, rootT: number, duration: number): boolean {
  if (rootT > duration) return false;
  if (id.startsWith('n') && p.nested?.duration !== undefined) return rootT - p.nested.at <= p.nested.duration;
  return true;
}

/** Frame times from `start`, each step short of one lap. */
const steps = fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 60 });

function play(h: ReturnType<typeof clocked>, from: number, ws: number[], most: number, until: () => boolean, cap = 2000): number {
  let t = from;
  for (let i = 0; i < cap && !until(); i++) {
    t += Math.max(1, Math.floor((ws[i % ws.length]! / 1000) * most));
    h.at(t);
  }
  return t;
}

describe('timeline, property', () => {
  it('fires each reachable event once a lap, however the frames fall', () => {
    const t = tally();
    fc.assert(fc.property(plan, fc.integer({ min: 0, max: 3 }), steps, (p, loops, ws) => {
      const b = build(p);
      const h = clocked();
      let done = 0;
      const tl = h.animator.timeline({ tracks: b.tracks, duration: p.duration, loop: loops, onDone: () => { done++; } });
      const d = tl.duration();
      h.at(0);
      play(h, 0, ws, Math.max(1, d - 1), () => done > 0, 4000);
      expect(done).toBe(1);
      const laps = d > 0 ? loops + 1 : 1;
      for (const [id, rootT] of b.times) {
        const n = b.fired.filter((f) => f.id === id).length;
        expect(n, `${id} at ${rootT} of ${d}`).toBe(reachable(p, id, rootT, d) ? laps : 0);
      }
      for (const f of b.fired) {
        expect(Number.isFinite(f.late)).toBe(true);
        expect(f.late).toBeGreaterThanOrEqual(0);
      }
      if (b.fired.length > 0 && loops > 0) t.count('looped events');
      if (p.nested && b.fired.some((f) => f.id.startsWith('n'))) t.count('nested events');
    }), { ...runs(RUNS), timeout: timeoutFor(RUNS, 40) });
    t.atLeast('looped events', 10);
    t.atLeast('nested events', 10);
  }, timeoutFor(RUNS, 40));

  it('samples its track where the playhead stands, after any frames, seeks, and rates', () => {
    const t = tally();
    const op = fc.oneof(
      fc.record({ seek: fc.integer({ min: -50, max: 1600 }) }),
      fc.record({ dt: fc.integer({ min: 0, max: 300 }) }),
      fc.record({ rate: fc.constantFrom(-2, -1, 0, 0.5, 1, 2) }),
    );
    fc.assert(fc.property(plan, fc.constantFrom<boolean | number>(false, true, 2), fc.array(op, { minLength: 1, maxLength: 25 }), (p, loop, ops) => {
      const b = build(p);
      const h = clocked();
      const tl = h.animator.timeline({ tracks: b.tracks, duration: p.duration, loop });
      const d = tl.duration();
      let now = 0;
      h.at(0);
      for (const o of ops) {
        const before = b.ticks.length;
        if ('seek' in o) {
          tl.seek(o.seek);
          if (loop === false) expect(tl.time()).toBe(Math.min(Math.max(o.seek, 0), d));
          t.count('seek');
        } else if ('rate' in o) {
          tl.setTimeScale(o.rate);
        } else {
          now += o.dt;
          h.at(now);
        }
        expect(tl.time()).toBeGreaterThanOrEqual(0);
        expect(tl.time()).toBeLessThanOrEqual(d);
        if (b.ticks.length > before) {
          expect(b.ticks.at(-1)).toBeCloseTo(sampleTrack(b.sampled, tl.time())!, 9);
          t.count('sampled');
        }
      }
    }), runs(RUNS));
    t.atLeast('seek', 50);
    t.atLeast('sampled', 50);
  });

  it('advances its playhead at the product of its own and the animator time scale', () => {
    const scale = fc.constantFrom(0.25, 0.5, 1, 2, 4);
    fc.assert(fc.property(plan, scale, scale, fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 20 }), (p, own, global, ds) => {
      const b = build(p);
      const h = clocked();
      const tl = h.animator.timeline({ tracks: b.tracks, duration: p.duration });
      tl.setTimeScale(own);
      h.animator.setTimeScale(global);
      h.at(0);
      let now = 0;
      for (const d of ds) {
        now += d;
        h.at(now);
        expect(tl.time()).toBeCloseTo(Math.min(now * own * global, tl.duration()), 6);
      }
    }), runs(RUNS));
  });

  it('plays backward under a negative time scale, sampling where it stands, firing nothing, and ends at 0', () => {
    const t = tally();
    fc.assert(fc.property(plan, fc.integer({ min: 0, max: 1500 }), fc.constantFrom(-0.5, -1, -2, -3), steps, (p, from, rate, ws) => {
      const b = build(p);
      const h = clocked();
      let done = 0;
      const tl = h.animator.timeline({ tracks: b.tracks, duration: p.duration, onDone: () => { done++; } });
      h.at(0);
      tl.seek(from);
      tl.setTimeScale(rate);
      b.fired.length = 0;
      if (tl.time() > 0) t.count('ran back');
      const end = play(h, 0, ws, 100, () => done > 0, 1000);
      if (done === 0) h.at(end + 100_000);
      expect(done).toBe(1);
      expect(tl.time()).toBe(0);
      expect(b.fired).toEqual([]);
      expect(b.ticks.at(-1)).toBeCloseTo(sampleTrack(b.sampled, 0)!, 9);
    }), runs(RUNS));
    t.atLeast('ran back', 30);
  });

  it('plays on from a seek as a fresh timeline sought there does', () => {
    const t = tally();
    fc.assert(fc.property(plan, fc.boolean(), steps, fc.integer({ min: 0, max: 1500 }), steps, fc.integer({ min: 0, max: 1500 }),
      (p, endless, before, to, after, run) => {
        const a = build(p), b = build(p);
        const ha = clocked(), hb = clocked();
        const loop = endless ? true : false;
        let parked = false;
        const ta: TimelineHandle = ha.animator.timeline({ tracks: a.tracks, duration: p.duration, loop, onDone: () => { parked = true; } });
        const tb: TimelineHandle = hb.animator.timeline({ tracks: b.tracks, duration: p.duration, loop });
        const d = ta.duration();
        ha.at(0);
        hb.at(0);
        const most = Math.max(1, d - 1);
        let elapsed = 0;
        const start = play(ha, 0, before, most, () => (elapsed += 1) > before.length);
        // A finished timeline sought to its end is not revived, by `setLoop`'s rule, and plays nothing more.
        if (parked && to >= d) return;
        ta.seek(to);
        tb.seek(to);
        expect(ta.time()).toBe(tb.time());
        a.fired.length = 0;
        b.fired.length = 0;
        let ra = start, rb = 0;
        for (let i = 0; i < after.length && ra - start < run; i++) {
          const dt = Math.max(1, Math.floor((after[i]! / 1000) * most));
          ra += dt; rb += dt;
          ha.at(ra);
          hb.at(rb);
          expect(ta.time()).toBeCloseTo(tb.time(), 6);
        }
        expect(a.fired.map((f) => f.id)).toEqual(b.fired.map((f) => f.id));
        a.fired.forEach((f, i) => expect(f.late).toBeCloseTo(b.fired[i]!.late, 6));
        expect(a.ticks.at(-1)).toBe(b.ticks.at(-1));
        if (a.fired.length > 0) t.count('fired after the seek');
      }), runs(RUNS));
    t.atLeast('fired after the seek', 10);
  });
});
