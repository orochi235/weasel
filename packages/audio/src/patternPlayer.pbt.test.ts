/**
 * The pattern player on an engine over a fake context, its passes run at uneven intervals: each note on a step of
 * the pass sounds once a pass at its own time and none other does; steps are reported in order, each a step's
 * length after the last at the tempo then in force; and when passes stall past a step, the steps still reported
 * stay on the grid, each named for where it falls on it.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createAudioEngine } from './createAudioEngine';
import { createPatternPlayer, patternLength, type PatternNote } from './patternPlayer';
import { createFakeAudioContext } from './testing/fakeAudioContext';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 60;
const LOOKAHEAD = 100;

/** An unlocked engine on a fake context, and a clock that advances by any amount before running the armed pass. */
async function harness() {
  const ctx = createFakeAudioContext();
  let pass: (() => void) | null = null;
  const engine = createAudioEngine({
    context: ctx as never,
    lookahead: LOOKAHEAD,
    voiceLimit: 1000,
    setTimer: (cb) => { pass = cb; return 1; },
    clearTimer: () => { pass = null; },
  });
  await engine.unlock();
  const flush = async () => { for (let i = 0; i < 5; i += 1) await Promise.resolve(); };
  const advance = async (ms: number) => {
    await flush();
    ctx._advance(ms);
    const p = pass;
    pass = null;
    p?.();
    await flush();
  };
  /** Each oscillator's start, in ms, with the note it plays. */
  const starts = () => ctx._oscillators.map((o) => ({ at: o.started[0]! * 1000, hz: (o as never as { frequency: { value: number } }).frequency.value }));
  return { ctx, engine, advance, starts };
}

const note: fc.Arbitrary<PatternNote> = fc.record({
  step: fc.oneof(fc.integer({ min: 0, max: 11 }), fc.double({ min: 0, max: 11.99, noNaN: true })),
  // A note apiece, so each start names its event.
  pitch: fc.constant(0),
  length: fc.constantFrom(0.5, 1, 2),
});
const pattern = fc.array(note, { minLength: 1, maxLength: 6 }).map((ns) => ns.map((n, i) => ({ ...n, pitch: { midi: 40 + i } })));
const gaps = fc.array(fc.integer({ min: 1, max: LOOKAHEAD }), { minLength: 1, maxLength: 8 });

describe('createPatternPlayer', () => {
  it('sounds each note on a step of the pass once a pass, at its own time', async () => {
    const seen = tally();
    await fc.assert(fc.asyncProperty(pattern, fc.integer({ min: 60, max: 300 }), fc.option(fc.integer({ min: 1, max: 12 }), { nil: undefined }), fc.boolean(), fc.integer({ min: 0, max: 500 }), gaps, async (events, tempo, length, loop, start, pace) => {
      const h = await harness();
      const stepMs = 60_000 / tempo / 4;
      const len = length ?? patternLength(events);
      const passes = loop ? 2 : 1;
      const player = createPatternPlayer(h.engine, { tempo, events, loop, ...(length !== undefined ? { length } : {}) });
      player.start(start);
      // Run past the end of the passes, at the uneven pace given.
      for (let t = 0, i = 0; t < start + passes * len * stepMs + 2 * LOOKAHEAD; i += 1) {
        const gap = pace[i % pace.length]!;
        t += gap;
        await h.advance(gap);
      }
      player.stop();
      const want = events.flatMap((e, i) => (Math.floor(e.step) < len
        ? Array.from({ length: passes }, (_, p) => ({ at: start + (p * len + e.step) * stepMs, hz: 440 * 2 ** ((40 + i - 69) / 12) }))
        : []));
      const got = h.starts().filter((s) => s.at < start + passes * len * stepMs - 1e-6);
      const key = (s: { at: number; hz: number }) => `${s.hz.toFixed(6)}@${s.at.toFixed(6)}`;
      expect(got.map(key).sort()).toEqual(want.map(key).sort());
      if (want.length < events.length * passes) seen.count('past the pass');
      if (loop) seen.count('looped');
    }), runs(RUNS));
    seen.atLeast('past the pass', RUNS / 10);
    seen.atLeast('looped', RUNS / 4);
  }, timeoutFor(RUNS, 60));

  it('reports steps in order, each a step after the last at the tempo in force', async () => {
    const seen = tally();
    await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 16 }), fc.array(fc.tuple(fc.integer({ min: 60, max: 300 }), fc.integer({ min: 1, max: 6 })), { minLength: 1, maxLength: 4 }), gaps, async (length, legs, pace) => {
      const h = await harness();
      const reported: { step: number; when: number; tempo: number }[] = [];
      let tempo = legs[0]![0];
      const player = createPatternPlayer(h.engine, { tempo, length, onStep: (step, when) => { reported.push({ step, when, tempo }); } });
      player.start(0);
      let i = 0;
      for (const [bpm, passesOf] of legs) {
        player.setTempo(bpm);
        tempo = bpm;
        for (let n = 0; n < passesOf * 4; n += 1) await h.advance(pace[i++ % pace.length]!);
      }
      for (let k = 1; k < reported.length; k += 1) {
        const [a, b] = [reported[k - 1]!, reported[k]!];
        expect(b.step).toBe((a.step + 1) % length);
        // A tempo set between steps applies from the next step not yet booked, or from now if that has passed.
        const gap = b.when - a.when;
        const [was, is] = [60_000 / a.tempo / 4, 60_000 / b.tempo / 4];
        if (a.tempo === b.tempo) {
          expect(gap).toBeCloseTo(is, 6);
        } else {
          expect(gap).toBeGreaterThanOrEqual(is - 1e-6);
          expect(gap).toBeLessThanOrEqual(Math.max(was, is) + 1e-6);
          seen.count('retimed');
        }
      }
      if (reported.length > length) seen.count('wrapped');
      player.stop();
    }), runs(RUNS));
    seen.atLeast('wrapped', RUNS / 4);
    seen.atLeast('retimed', RUNS / 4);
  }, timeoutFor(RUNS, 60));

  it('keeps steps on the grid when passes stall, naming each for where it falls', async () => {
    const seen = tally();
    await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 16 }), fc.integer({ min: 60, max: 300 }), fc.array(fc.integer({ min: 1, max: 1500 }), { minLength: 1, maxLength: 8 }), async (length, tempo, pace) => {
      const h = await harness();
      const stepMs = 60_000 / tempo / 4;
      const reported: { step: number; when: number }[] = [];
      const player = createPatternPlayer(h.engine, { tempo, length, onStep: (step, when) => { reported.push({ step, when }); } });
      player.start(0);
      for (let n = 0; n < 12; n += 1) await h.advance(pace[n % pace.length]!);
      for (const r of reported) {
        const k = r.when / stepMs;
        expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
        expect(r.step).toBe(Math.round(k) % length);
      }
      for (let k = 1; k < reported.length; k += 1) expect(reported[k]!.when).toBeGreaterThan(reported[k - 1]!.when);
      if (reported.some((r, k) => k > 0 && r.when - reported[k - 1]!.when > stepMs * 1.5)) seen.count('skipped');
      player.stop();
    }), runs(RUNS));
    seen.atLeast('skipped', RUNS / 4);
  }, timeoutFor(RUNS, 60));
});
