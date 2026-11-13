/**
 * Properties of the graph's built-in nodes. A mix holds a port and a level for every name it is given, prototype
 * names included. A source's params, written with any value while it plays or not, leave every later start
 * working: a value an AudioParam refuses is refused at the write. And the file source's playhead, through starts,
 * stops, rate ramps, and time of any length, resumes where a model integrating its rate says it stopped.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createAudioGraph } from './createAudioGraph';
import { createPlayhead } from './playhead';
import { createMixNode } from './processors';
import { createFileSourceNode, createNoiseNode, createOscillatorNode } from './sources';
import type { GraphNodeDef } from './types';
import { createFakeAudioContext, type FakeAudioContext } from '../testing/fakeAudioContext';
import { runs, tally, timeoutFor } from '../pbt.fixture';

const seen = tally();
const PROTO = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'];
const name = fc.oneof(fc.string({ maxLength: 4 }), fc.constantFrom(...PROTO));

describe('a mix node', () => {
  it('has an own port and level param for each name, and the graph connects to each', () => {
    fc.assert(fc.property(fc.uniqueArray(name, { minLength: 1, maxLength: 6 }), (names) => {
      const ctx = createFakeAudioContext();
      const def = createMixNode(ctx as never, { inputs: names });
      expect(Object.keys(def.inputs).sort()).toEqual([...names].sort());
      expect(Object.keys(def.params).sort()).toEqual([...names].sort());
      const graph = createAudioGraph(ctx as never, ctx.destination as never);
      graph.add('mix', def);
      graph.add('src', { inputs: {}, output: ctx.createGain() as never, params: {} });
      for (const n of names) {
        graph.connect('src', { node: 'mix', port: n });
        graph.set('mix', n, 0.5);
      }
    }), runs(300));
  });
});

type Write = { param: string; value: number; ramp: number };
const SOURCES: { kind: string; params: string[]; make(ctx: FakeAudioContext): GraphNodeDef }[] = [
  { kind: 'oscillator', params: ['frequency', 'detune', 'level'], make: (ctx) => createOscillatorNode(ctx as never, {}) },
  { kind: 'oscillator-partials', params: ['frequency', 'detune', 'level'], make: (ctx) => createOscillatorNode(ctx as never, { wave: [1, 0.5] }) },
  { kind: 'file', params: ['rate', 'level'], make: (ctx) => createFileSourceNode(ctx as never, { buffer: ctx.createBuffer(1, 4410, 44100) as never }) },
  { kind: 'noise', params: ['level'], make: (ctx) => createNoiseNode(ctx as never, { color: 'white' }) },
];
const value = fc.oneof(
  { weight: 4, arbitrary: fc.double({ min: -1000, max: 1000, noNaN: true }) },
  { weight: 1, arbitrary: fc.constantFrom(NaN, Infinity, -Infinity) },
);
const ramp = fc.oneof(fc.constant(0), fc.double({ min: 0, max: 100, noNaN: true }), fc.constantFrom(NaN, Infinity));

describe('a source node in a graph', () => {
  it('refuses a non-finite param write whether or not it plays, and always starts again', () => {
    const step = fc.oneof(
      fc.constant({ kind: 'start' as const }),
      fc.constant({ kind: 'stop' as const }),
      fc.constant({ kind: 'settle' as const }),
      fc.record({ kind: fc.constant('set' as const), param: fc.nat(2), value, ramp }),
    );
    fc.assert(fc.property(fc.constantFrom(...SOURCES), fc.array(step, { maxLength: 25 }), (src, steps) => {
      const ctx = createFakeAudioContext();
      ctx.state = 'running';
      const timers = new Map<number, () => void>();
      let next = 0;
      const graph = createAudioGraph(ctx as never, ctx.destination as never, {
        setTimer: (cb) => { next += 1; timers.set(next, cb); return next; },
        clearTimer: (h) => { timers.delete(h as number); },
      });
      graph.add('s', src.make(ctx));
      graph.connect('s', { output: true });
      const settle = (): void => {
        for (let i = 0; i < 50 && timers.size; i += 1) {
          ctx._advance(20);
          const due = [...timers.values()];
          timers.clear();
          for (const f of due) f();
        }
      };
      for (const s of [...steps, { kind: 'start' as const }]) {
        if (s.kind === 'start') { graph.start(); seen.count(`start`); }
        else if (s.kind === 'stop') graph.stop();
        else if (s.kind === 'settle') settle();
        else {
          const w: Write = { param: src.params[s.param % src.params.length], value: s.value, ramp: s.ramp };
          const bad = !Number.isFinite(w.value) || !Number.isFinite(w.ramp);
          if (bad) {
            expect(() => graph.set('s', w.param, w.value, w.ramp)).toThrow(RangeError);
            seen.count(`refused ${graph.isPlaying() ? 'playing' : 'stopped'}`);
          } else graph.set('s', w.param, w.value, w.ramp);
        }
      }
      expect(graph.isPlaying()).toBe(true);
    }), runs(400));
    seen.atLeast('refused stopped', 20);
    seen.atLeast('refused playing', 20);
  }, timeoutFor(400, 5));
});

/** A model of the playhead's position by integrating its rate over the time it plays. */
interface PlayModel { now: number; playing: boolean; pos: number; a: number; ra: number; b: number; rb: number }
const rateAt = (m: PlayModel, t: number): number => (t >= m.b ? m.rb : m.ra + ((m.rb - m.ra) * (t - m.a)) / (m.b - m.a));
function integrate(m: PlayModel, t0: number, t1: number): number {
  const cut = Math.min(Math.max(m.b, t0), t1);
  const ramped = ((cut - t0) * (rateAt(m, t0) + rateAt(m, cut))) / 2;
  return ramped + (t1 - cut) * m.rb;
}

describe('the file source playhead', () => {
  it('starts where integrating its rate over the time it played says it stopped', () => {
    const cmd = fc.oneof(
      fc.record({ kind: fc.constant('wait' as const), s: fc.oneof(fc.double({ min: 0, max: 5, noNaN: true }), fc.constantFrom(0, 1e-9)) }),
      fc.constant({ kind: 'start' as const }),
      fc.constant({ kind: 'stop' as const }),
      fc.record({ kind: fc.constant('rate' as const), value: fc.double({ min: -4, max: 4, noNaN: true }), ms: fc.oneof(fc.constant(0), fc.double({ min: 0, max: 3000, noNaN: true })) }),
    );
    fc.assert(fc.property(fc.double({ min: 0.01, max: 50, noNaN: true }), fc.boolean(), fc.double({ min: -2, max: 2, noNaN: true }), fc.array(cmd, { maxLength: 40 }), (duration, loop, initial, cmds) => {
      const head = createPlayhead(duration, loop, initial);
      const m: PlayModel = { now: 0, playing: false, pos: 0, a: 0, ra: initial, b: 0, rb: initial };
      const wrap = (p: number): number => (loop ? ((p % duration) + duration) % duration : Math.min(Math.max(p, 0), duration));
      let traveled = 0;
      for (const c of [...cmds, { kind: 'start' as const }]) {
        if (c.kind === 'wait') {
          if (m.playing) {
            const d = integrate(m, m.now, m.now + c.s);
            m.pos += d;
            traveled += Math.abs(d);
          }
          m.now += c.s;
        } else if (c.kind === 'rate') {
          m.pos = wrap(m.pos);
          const r = rateAt(m, m.now);
          Object.assign(m, { a: m.now, ra: r, b: m.now + c.ms / 1000, rb: c.value });
          head.rate(c.value, c.ms, m.now);
        } else if (c.kind === 'stop') {
          if (m.playing) head.stop(m.now, m.now);
          m.playing = false;
        } else if (!m.playing) {
          const got = head.start(m.now, m.now);
          const want = wrap(m.pos);
          const tol = 1e-9 * (1 + traveled + duration);
          const off = Math.abs(got - want);
          expect(loop ? Math.min(off, duration - off) : off).toBeLessThanOrEqual(tol);
          expect(got).toBeGreaterThanOrEqual(0);
          expect(loop ? got < duration : got <= duration).toBe(true);
          m.pos = want;
          Object.assign(m, { a: m.now, ra: m.rb, b: m.now, rb: m.rb });
          m.playing = true;
          seen.count(traveled > 0 ? 'resumed moved' : 'resumed');
        }
      }
    }), runs(500));
    seen.atLeast('resumed moved', 10);
  });
});
