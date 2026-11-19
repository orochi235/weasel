import { createAudioEngine } from '../createAudioEngine';
import { createFakeAudioContext } from './fakeAudioContext';

/** The scheduler's default pass interval, and the step `run` advances by. */
const PASS_MS = 25;

/** An unlocked engine on a fake context whose clock only `run` advances. */
export async function engineHarness() {
  const ctx = createFakeAudioContext();
  // Every timer the engine sets, by handle: the scheduler's pass shares this
  // pair with fades and stream stops, so one slot would let them replace it.
  const timers = new Map<number, { cb: () => void; due: number }>();
  let nextId = 0;
  let elapsed = 0;
  const engine = createAudioEngine({
    context: ctx as never,
    setTimer: (cb, ms) => { nextId += 1; timers.set(nextId, { cb, due: elapsed + ms }); return nextId; },
    clearTimer: (h) => { timers.delete(h as number); },
    fetchFn: (async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as never,
  });
  await engine.unlock();
  const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
  /** Advance the audio clock by `ms`, in scheduler-sized passes, firing each
   *  timer once its delay has run out. */
  const run = async (ms: number) => {
    await flush();
    for (let left = ms; left > 0; left -= PASS_MS) {
      const step = Math.min(PASS_MS, left);
      ctx._advance(step);
      elapsed += step;
      const due = [...timers].filter(([, t]) => t.due <= elapsed + 1e-9);
      for (const [id] of due) timers.delete(id);
      for (const [, t] of due) t.cb();
      await flush();
    }
  };
  /** When each oscillator starts, in ms. */
  const starts = () => ctx._oscillators.map((o) => Math.round(o.started[0] * 1000));
  return { ctx, engine, run, flush, starts };
}
