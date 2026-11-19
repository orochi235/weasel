import { createAudioEngine } from '../createAudioEngine';
import { createFakeAudioContext } from './fakeAudioContext';
import { fakeTimers } from './fakeTimers';

/** The scheduler's pass length, in ms. */
const PASS_MS = 25;

/** An unlocked engine on a fake context whose clock only `run` advances. */
export async function engineHarness() {
  const ctx = createFakeAudioContext();
  // The scheduler, insert fades, stream starts and patch transitions all share
  // this pair, so each timer keeps a handle of its own.
  const timers = fakeTimers();
  const engine = createAudioEngine({
    context: ctx as never,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    fetchFn: (async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as never,
  });
  await engine.unlock();
  const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
  /** Advance the audio clock by `ms`, in scheduler-sized passes; the last pass
   *  is whatever is left, so the clock lands on `ms` exactly. */
  const run = async (ms: number) => {
    await flush();
    for (let t = 0; t < ms; t += PASS_MS) {
      ctx._advance(Math.min(PASS_MS, ms - t));
      timers.fire();
      await flush();
    }
  };
  /** When each oscillator starts, in ms. */
  const starts = () => ctx._oscillators.map((o) => Math.round(o.started[0] * 1000));
  return { ctx, engine, run, flush, starts, timers };
}
