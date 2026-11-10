import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { EASINGS, type EasingName } from '@weasel-js/geom';
import { createTarget } from '../target';
import { bindClip, toClip, type Clip, type ClipBinder, type ClipTrack } from './clip';
import { runs, tally } from '../pbt.fixture';

const RUNS = runs(300);

const t = fc.oneof(fc.integer({ min: 0, max: 1000 }), fc.double({ min: 0, max: 1000, noNaN: true }));
const easing = fc.option(fc.oneof(
  fc.constantFrom(...(Object.keys(EASINGS) as EasingName[])),
  fc.tuple(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: -2, max: 2, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: -2, max: 2, noNaN: true }))
    .map((b) => ({ bezier: b })),
), { nil: undefined });
const num = fc.double({ min: -1e6, max: 1e6, noNaN: true }).map((x) => x + 0);
const field = fc.constantFrom('x', 'y', 'angle', 'constructor', '__proto__', 'data', '__ta');
/** A key value a track with no target holds: a number, an array, a plain object of numbers, or one carrying a typed array. */
const free = fc.oneof(
  num,
  fc.array(num, { maxLength: 3 }),
  fc.uniqueArray(fc.tuple(field, num), { minLength: 1, maxLength: 3, selector: ([k]) => k }).map((es) => JSON.parse(JSON.stringify(Object.fromEntries(es)))),
  fc.array(num, { maxLength: 3 }).map((data) => ({ __ta: 'f64', data })),
);
const sorted = <K extends { t: number }>(ks: K[]): K[] => ks.sort((a, b) => a.t - b.t);
const opt = <T>(a: fc.Arbitrary<T>) => fc.option(a, { nil: undefined });
const label = opt(fc.string({ maxLength: 4 }));

const onTarget: fc.Arbitrary<ClipTrack> = fc.record({
  kind: fc.constant('sampled' as const), label, target: fc.constant('pos'),
  keys: fc.array(fc.record({ t, value: fc.record({ x: num, y: num }), easing }), { minLength: 1, maxLength: 4 }).map(sorted),
  weight: opt(fc.oneof(fc.double({ min: 0, max: 1, noNaN: true }), fc.constant('fade'))),
  axes: opt(fc.constantFrom(['x'], ['y'], ['x', 'y'], [0], [1, 0])),
}, { requiredKeys: ['kind', 'target', 'keys'] }) as fc.Arbitrary<ClipTrack>;
const offTarget: fc.Arbitrary<ClipTrack> = fc.record({
  kind: fc.constant('sampled' as const), label,
  keys: fc.array(fc.record({ t, value: free, easing }), { minLength: 1, maxLength: 4 }).map(sorted),
  interpolate: opt(fc.constant('step')),
}, { requiredKeys: ['kind', 'keys'] }) as fc.Arbitrary<ClipTrack>;
const events: fc.Arbitrary<ClipTrack> = fc.record({
  kind: fc.constant('event' as const), label,
  events: fc.array(fc.record({ t, name: fc.constantFrom('beep', 'flash'), data: opt(fc.jsonValue({ maxDepth: 2 })) }, { requiredKeys: ['t', 'name'] }), { maxLength: 3 }).map(sorted),
}, { requiredKeys: ['kind', 'events'] }) as fc.Arbitrary<ClipTrack>;

const { tracks } = fc.letrec<{ tracks: ClipTrack[]; track: ClipTrack }>((tie) => ({
  track: fc.oneof({ depthSize: 'small', withCrossShrink: true }, onTarget, offTarget, events,
    fc.record({ kind: fc.constant('timeline' as const), label, at: t, timeline: fc.record({ tracks: tie('tracks'), duration: opt(t) }, { requiredKeys: ['tracks'] }) },
      { requiredKeys: ['kind', 'at', 'timeline'] }) as fc.Arbitrary<ClipTrack>),
  tracks: fc.array(tie('track') as fc.Arbitrary<ClipTrack>, { maxLength: 3 }) as unknown as fc.Arbitrary<ClipTrack>,
})) as unknown as { tracks: fc.Arbitrary<ClipTrack[]> };

const clip: fc.Arbitrary<Clip> = fc.record({ version: fc.constant(1 as const), tracks, duration: opt(t) }, { requiredKeys: ['version', 'tracks'] });

function binder(): ClipBinder {
  const pos = createTarget({ get: () => ({ x: 0, y: 0 }), set: () => {} });
  return {
    target: (name) => (name === 'pos' ? pos : undefined),
    interpolate: { step: (a: unknown, b: unknown, u: number) => (u < 1 ? a : b) },
    weight: (name) => (name === 'fade' ? () => 0.5 : undefined),
    event: () => ({ fire: () => {} }),
  };
}

/** `v` as JSON would write and read it. */
const viaJson = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('clips, property', () => {
  it('read back through bindClip and toClip as they were', () => {
    const tl = tally();
    fc.assert(fc.property(clip, (c) => {
      const live = bindClip(c, binder());
      expect(viaJson(toClip(live))).toEqual(viaJson(c));
      if (JSON.stringify(c).includes('"timeline"')) tl.count('nested');
      if (JSON.stringify(c).includes('__ta')) tl.count('typed array');
    }), RUNS);
    tl.atLeast('nested', 20);
    tl.atLeast('typed array', 20);
  });

  it('bind from their JSON as from themselves', () => {
    fc.assert(fc.property(clip, (c) => {
      expect(viaJson(toClip(bindClip(viaJson(c), binder())))).toEqual(viaJson(toClip(bindClip(c, binder()))));
    }), RUNS);
  });
});
