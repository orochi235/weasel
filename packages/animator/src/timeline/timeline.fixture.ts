/**
 * Timeline plans shared by the timeline's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { EventTrack, SampledTrack, Track } from './types';

export interface Plan {
  /** Event times on the root's event track. */
  events: number[];
  /** A nested timeline's start and event times, and its own duration if it states one. */
  nested: { at: number; events: number[]; duration?: number } | null;
  /** The sampled track's keys, as (time, value) pairs on a whole-ms grid. */
  keys: [number, number][];
  duration?: number;
}

const ms = fc.integer({ min: 0, max: 400 });
export const plan: fc.Arbitrary<Plan> = fc.record({
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

export interface Built {
  tracks: Track[];
  sampled: SampledTrack<number>;
  fired: { id: string; late: number }[];
  ticks: number[];
  /** Each event id with the root time it sits at. */
  times: Map<string, number>;
}

export function build(p: Plan): Built {
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
export function reachable(p: Plan, id: string, rootT: number, duration: number): boolean {
  if (rootT > duration) return false;
  if (id.startsWith('n') && p.nested?.duration !== undefined) return rootT - p.nested.at <= p.nested.duration;
  return true;
}
