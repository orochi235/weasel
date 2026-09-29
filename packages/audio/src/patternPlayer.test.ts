import { describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import { createPatternPlayer } from './patternPlayer';
import { createFakeAudioContext } from './testing/fakeAudioContext';

async function harness() {
  const ctx = createFakeAudioContext();
  let pass: (() => void) | null = null;
  const engine = createAudioEngine({
    context: ctx as never,
    setTimer: (cb) => { pass = cb; return 1; },
    clearTimer: () => { pass = null; },
    fetchFn: (async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as never,
  });
  await engine.unlock();
  const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
  /** Advance the audio clock in scheduler-sized passes. */
  const run = async (ms: number) => {
    await flush();
    for (let t = 0; t < ms; t += 25) {
      ctx._advance(25);
      pass?.();
      await flush();
    }
  };
  const starts = () => ctx._oscillators.map((o) => Math.round(o.started[0] * 1000));
  return { ctx, engine, run, flush, starts };
}

// 120 bpm in sixteenths: 125 ms a step.
describe('createPatternPlayer', () => {
  it('books each step through the scheduler, and loops', async () => {
    const { engine, run, starts } = await harness();
    const player = createPatternPlayer(engine, {
      tempo: 120,
      length: 4,
      events: [{ step: 0, pitch: 'C4' }, { step: 2, pitch: 'E4' }],
    });
    player.start(0);
    await run(800);
    expect(starts()).toEqual([0, 250, 500, 750]);
    expect(player.playing()).toBe(true);
  });

  it('gates a note for its length in steps', async () => {
    const { ctx, engine, run } = await harness();
    createPatternPlayer(engine, {
      tempo: 120,
      events: [{ step: 0, length: 2, pitch: 220, envelope: { release: 10 } }],
    }).start(0);
    await run(25);
    expect(ctx._oscillators[0].stopped[0]).toBeCloseTo(0.26, 9);
  });

  it('plays a buffer hit as well as a note', async () => {
    const { ctx, engine, run } = await harness();
    const kick = await engine.load('/kick.wav');
    createPatternPlayer(engine, {
      tempo: 120, length: 4, loop: false,
      events: [{ step: 1, sound: kick, gain: 0.5 }],
    }).start(0);
    await run(600);
    expect(ctx._sources.map((s) => s.started[0])).toEqual([0.125]);
  });

  it('lands a tempo change on the next step', async () => {
    const { engine, run } = await harness();
    const seen: number[] = [];
    const player = createPatternPlayer(engine, {
      tempo: 120, length: 16, onStep: (_step, when) => seen.push(when),
    });
    player.start(0);
    await run(0);
    expect(seen).toEqual([0]);
    player.setTempo(60);
    await run(600);
    expect(seen).toEqual([0, 250, 500]);
    expect(player.tempo()).toBe(60);
  });

  it('reports the step within the pattern, wrapping at its length', async () => {
    const { engine, run } = await harness();
    const steps: number[] = [];
    createPatternPlayer(engine, { tempo: 120, length: 3, onStep: (s) => steps.push(s) }).start(0);
    await run(500);
    expect(steps).toEqual([0, 1, 2, 0, 1]);
  });

  it('defaults its length to the events rounded up to a whole beat', async () => {
    const { engine, run } = await harness();
    const steps: number[] = [];
    createPatternPlayer(engine, {
      tempo: 120, events: [{ step: 5, pitch: 220 }], onStep: (s) => steps.push(s),
    }).start(0);
    await run(900);
    expect(steps).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0]);
  });

  it('ends after one pass when it does not loop', async () => {
    const { engine, run, starts } = await harness();
    const player = createPatternPlayer(engine, {
      tempo: 120, length: 2, loop: false, events: [{ step: 0, pitch: 220 }],
    });
    player.start(0);
    await run(1000);
    expect(starts()).toEqual([0]);
    expect(player.playing()).toBe(false);
  });

  it('stops booking on stop, and releases what is still sounding', async () => {
    const { ctx, engine, run, starts } = await harness();
    const player = createPatternPlayer(engine, {
      tempo: 120, length: 4,
      events: [{ step: 0, length: 4, pitch: 220, envelope: { release: 20 } }],
    });
    player.start(0);
    await run(100);
    player.stop();
    expect(player.playing()).toBe(false);
    expect(ctx._oscillators[0].stopped.at(-1)).toBeCloseTo(0.12, 9);
    await run(1000);
    expect(starts()).toEqual([0]);
  });

  it('swaps its events from the next step', async () => {
    const { engine, run, ctx } = await harness();
    const player = createPatternPlayer(engine, {
      tempo: 120, length: 2, events: [{ step: 0, pitch: 220 }, { step: 1, pitch: 220 }],
    });
    player.start(0);
    await run(0);
    player.setEvents([{ step: 1, pitch: 330 }]);
    await run(200);
    const pitches = ctx._oscillators.map((o) => o.frequency.holds[0].value);
    expect(pitches).toEqual([220, 330]);
  });

  it('skips steps it slept through, in phase, rather than playing them in a burst', async () => {
    const { ctx, engine, run, starts } = await harness();
    createPatternPlayer(engine, {
      tempo: 120, length: 16, events: Array.from({ length: 16 }, (_, step) => ({ step, pitch: 220 })),
    }).start(0);
    await run(0);
    // A stalled timer: the clock runs on with no pass.
    ctx._advance(1000);
    await run(25);
    expect(starts()).toEqual([0, 1125]);
  });

  it('rejects a tempo that is not positive', async () => {
    const { engine } = await harness();
    expect(() => createPatternPlayer(engine, { tempo: 0 })).toThrow(RangeError);
    const player = createPatternPlayer(engine, { tempo: 90 });
    expect(() => player.setTempo(-1)).toThrow(RangeError);
  });

  it('does nothing on a second start', async () => {
    const { engine, run } = await harness();
    const onStep = vi.fn();
    const player = createPatternPlayer(engine, { tempo: 120, length: 4, onStep });
    player.start(0);
    player.start(0);
    await run(0);
    expect(onStep).toHaveBeenCalledTimes(1);
  });
});
