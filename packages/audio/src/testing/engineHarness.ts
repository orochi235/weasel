import { createAudioEngine } from '../createAudioEngine';
import { createFakeAudioContext } from './fakeAudioContext';

/** An unlocked engine on a fake context whose clock only `run` advances. */
export async function engineHarness() {
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
  /** When each oscillator starts, in ms. */
  const starts = () => ctx._oscillators.map((o) => Math.round(o.started[0] * 1000));
  return { ctx, engine, run, flush, starts };
}
