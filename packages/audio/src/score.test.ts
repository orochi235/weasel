import { describe, expect, it } from 'vitest';
import { midiToFrequency } from './pitch';
import { createScore, type ScoreState } from './score';
import { scoreCues, type ScoreMood } from './scoreMood';
import { engineHarness } from './testing/engineHarness';

const home = (name: string): ScoreMood => scoreCues.find((c) => c.name === name)!.mood;
const unique = (xs: number[]) => [...new Set(xs)];

// Dread is 60 bpm, a 4000 ms bar. Urgency is 140 bpm: a bar is 12000/7 ms.
const URGENT_BAR = 12000 / 7;

describe('createScore', () => {
  it('plays its mood through the engine, a bar at a time', async () => {
    const { ctx, engine, run, starts } = await engineHarness();
    createScore(engine, { mood: home('dread') }).start(0);
    await run(100);
    expect(starts()).toEqual([0, 0, 0]);
    expect(ctx._oscillators.map((o) => o.frequency.holds[0].value))
      .toEqual([36, 37, 42].map(midiToFrequency));
    await run(4000);
    expect(starts()).toEqual([0, 0, 0, 4000, 4000, 4000]);
  });

  it('says which cue it is applying, and with what', async () => {
    const { engine } = await engineHarness();
    const score = createScore(engine, { mood: home('wonder') });
    const state = score.state();
    expect(state.cue.name).toBe('wonder');
    expect(state.cue.weights.wonder).toBe(1);
    expect(state.params.mode).toBe('lydian');
    expect([state.bar, state.cueBar]).toEqual([0, 0]);
  });

  it('reports each bar as it is booked, with the time it starts', async () => {
    const { engine, run } = await engineHarness();
    const bars: [number, number][] = [];
    createScore(engine, {
      mood: home('urgency'),
      onBar: (state, when) => bars.push([state.bar, Math.round(when)]),
    }).start(0);
    await run(2 * URGENT_BAR);
    expect(bars).toEqual([[0, 0], [1, 1714], [2, 3429]]);
  });

  it('takes a new mood at the next bar line, tempo and all', async () => {
    const { engine, run, starts } = await engineHarness();
    const seen: ScoreState[] = [];
    const score = createScore(engine, { mood: home('urgency'), onBar: (state) => seen.push(state) });
    score.start(0);
    await run(500);
    score.setMood(home('dread'));
    expect(score.mood()).toEqual(home('dread'));
    expect(score.state().cue.name).toBe('urgency');
    await run(URGENT_BAR + 4000 - 500);

    const times = unique(starts());
    const inFirstBar = times.filter((t) => t < 1714);
    expect(inFirstBar).toHaveLength(16);
    expect(times.filter((t) => t >= 1714)).toEqual([1714, 5714]);
    expect(seen.map((s) => s.cue.name)).toEqual(['urgency', 'dread', 'dread']);
    expect(score.state().params.tempo).toBe(60);
  });

  it('starts a new cue from its first layer, and keeps building one it stays in', async () => {
    const { engine, run } = await engineHarness();
    const seen: [string, number][] = [];
    const score = createScore(engine, {
      mood: home('urgency'),
      onBar: (state) => seen.push([state.cue.name, state.cueBar]),
    });
    score.start(0);
    await run(URGENT_BAR + 100);
    score.setMood({ ...home('urgency'), tension: 0.75 });
    await run(URGENT_BAR);
    score.setMood(home('investigation'));
    await run(URGENT_BAR);
    expect(seen).toEqual([['urgency', 0], ['urgency', 1], ['urgency', 2], ['investigation', 0]]);
  });

  it('releases what is sounding on stop, and starts over from bar 0', async () => {
    const { ctx, engine, run, starts } = await engineHarness();
    const bars: number[] = [];
    const score = createScore(engine, { mood: home('dread'), onBar: (state) => bars.push(state.bar) });
    score.start(0);
    await run(4100);
    score.stop();
    expect(score.playing()).toBe(false);
    for (const o of ctx._oscillators) expect(o.stopped.length).toBeGreaterThan(0);
    await run(5000);
    expect(starts()).toHaveLength(6);
    score.start();
    await run(100);
    expect(bars).toEqual([0, 1, 0]);
  });

  it('passes its routing on to every note', async () => {
    const { ctx, engine, run } = await engineHarness();
    createScore(engine, { mood: home('dread'), tonic: 2 }).start(0);
    await run(100);
    expect(ctx._oscillators.map((o) => o.frequency.holds[0].value))
      .toEqual([38, 39, 44].map(midiToFrequency));
  });
});
