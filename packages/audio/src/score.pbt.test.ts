/**
 * Stateful test of a generative score through starts at any offset, stops, mood changes, and clock advances of
 * any length, stalls past a whole bar included. Within a run the bars reported count up, the first is the bar its
 * time falls in from the start, and at one tempo throughout so is each; `cueBar` counts the bars since the cue
 * last changed; the mood a bar reports was the one set when it was booked or one set since the bar before it;
 * `state()` is the last bar reported; and nothing is reported while stopped.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createAudioEngine } from './createAudioEngine';
import { createScore, type ScoreState } from './score';
import { scoreCues, type ScoreMood } from './scoreMood';
import { createFakeAudioContext } from './testing/fakeAudioContext';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 40;
const seen = tally();

async function harness() {
  const ctx = createFakeAudioContext();
  let pass: (() => void) | null = null;
  const engine = createAudioEngine({
    context: ctx as never,
    voiceLimit: 1000,
    setTimer: (cb) => { pass = cb; return 1; },
    clearTimer: () => { pass = null; },
  });
  await engine.unlock();
  const flush = async () => { for (let i = 0; i < 5; i += 1) await Promise.resolve(); };
  /** Advance the clock by `ms` in passes of `pace`, so a pace past a step stalls the scheduler. */
  const advance = async (ms: number, pace: number) => {
    for (let t = 0; t < ms; t += pace) {
      await flush();
      ctx._advance(Math.min(pace, ms - t));
      const p = pass;
      pass = null;
      p?.();
      await flush();
    }
  };
  return { ctx, engine, advance };
}

const mood: fc.Arbitrary<ScoreMood> = fc.oneof(
  fc.constantFrom(...scoreCues.map((c) => c.mood)),
  fc.record({ valence: fc.double({ min: -1, max: 1, noNaN: true }), tension: fc.double({ min: 0, max: 1, noNaN: true }), urgency: fc.double({ min: 0, max: 1, noNaN: true }) }),
);
type Cmd =
  | { kind: 'advance'; ms: number; pace: number }
  | { kind: 'mood'; mood: ScoreMood }
  | { kind: 'start'; offset: number }
  | { kind: 'stop' };
const cmd: fc.Arbitrary<Cmd> = fc.oneof(
  { weight: 5, arbitrary: fc.record({ kind: fc.constant('advance' as const), ms: fc.integer({ min: 1, max: 9000 }), pace: fc.oneof({ weight: 3, arbitrary: fc.constant(25) }, fc.integer({ min: 26, max: 6000 })) }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('mood' as const), mood }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('start' as const), offset: fc.integer({ min: -500, max: 500 }) }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'stop' as const }) },
);

describe('createScore', () => {
  it('reports each run\'s bars in order, each the bar its time falls in, through stalls and mood changes', async () => {
    await fc.assert(fc.asyncProperty(mood, fc.array(cmd, { minLength: 1, maxLength: 14 }), fc.boolean(), async (first, given, fixed) => {
      // Half the runs keep one mood, so one tempo, throughout.
      const cmds = fixed ? given.filter((c) => c.kind !== 'mood') : given;
      const h = await harness();
      const bars: { state: ScoreState; when: number; moods: ScoreMood[] }[] = [];
      /** Moods set since the last bar was reported, the one in force first. */
      let moods: ScoreMood[] = [first];
      let runStart: { at: number; from: number } | null = null;
      const score = createScore(h.engine, {
        mood: first,
        onBar: (state, when) => {
          expect(runStart).not.toBeNull();
          bars.push({ state, when, moods });
          moods = [moods[moods.length - 1]];
        },
      });
      for (const c of [{ kind: 'start', offset: 0 } as Cmd, ...cmds]) {
        if (c.kind === 'advance') await h.advance(c.ms, c.pace);
        else if (c.kind === 'mood') { score.setMood(c.mood); moods.push(c.mood); }
        else if (c.kind === 'stop') { score.stop(); runStart = null; }
        else if (!score.isPlaying()) {
          runStart = { at: Math.max(0, h.engine.now() + c.offset), from: bars.length };
          score.start(runStart.at);
        }
        if (runStart && bars.length > runStart.from) {
          expect(score.state()).toBe(bars[bars.length - 1].state);
        }
        if (!runStart) continue;
        const run = bars.slice(runStart.from);
        for (let i = 0; i < run.length; i += 1) {
          const { state, when } = run[i];
          const prev = i > 0 ? run[i - 1] : null;
          // A run's first bar is 0 unless a stall skipped it whole.
          if (!prev) expect(state.bar).toBe(Math.floor((when - runStart.at) / (240_000 / state.params.tempo) + 1e-9));
          else expect(state.bar).toBeGreaterThan(prev.state.bar);
          // At one tempo throughout, the bar a time falls in.
          if (fixed) expect(state.bar).toBe(Math.floor((when - runStart.at) / (240_000 / state.params.tempo) + 1e-9));
          if (prev) expect(when).toBeGreaterThan(prev.when);
          if (prev && prev.state.cue.name === state.cue.name) expect(state.cueBar).toBe(prev.state.cueBar + state.bar - prev.state.bar);
          if (!prev || prev.state.cue.name !== state.cue.name) expect(state.cueBar).toBe(0);
          expect(run[i].moods).toContainEqual(state.mood);
          seen.count(prev && state.bar - prev.state.bar > 1 ? 'skipped bars' : 'next bar');
        }
      }
    }), runs(RUNS));
    seen.atLeast('next bar', 50);
    seen.atLeast('skipped bars', 5);
  }, timeoutFor(RUNS, 400));
});
