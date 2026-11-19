import { createAudioEngine, type AudioEngine } from '@weasel-js/audio';
import type { AudioEngineOptions } from '../types';

/** A centered voice leaves a stereo panner at this gain per channel. */
export const CENTER_GAIN = Math.SQRT1_2;

/**
 * Render whatever `play` books on a real engine, through an
 * `OfflineAudioContext`, and return the left channel. Browser only.
 *
 * An offline context reports 'suspended' until it renders, and the engine drops
 * a voice played on a context that is not running, so the context is made to
 * report 'running' from the start. Voices at `when: 0` are booked at the end of
 * the calling task, which is why rendering waits a task first.
 */
export async function renderEngine(
  seconds: number,
  play: (engine: AudioEngine) => void,
  rate = 48000,
  opts: Omit<AudioEngineOptions, 'context' | 'setTimer' | 'clearTimer'> = {},
): Promise<Float32Array> {
  return (await renderEngineStereo(seconds, play, rate, opts))[0];
}

/** An offline render's suspend times are rounded down to a render quantum. */
const QUANTUM = 128;

/** Where a `later` hook can pause the render: inside it, and past the first
 *  quantum when the worklet hold already pauses there. `suspend` rejects any
 *  other time, and the hook would silently never run. */
function requireLaterTime(at: number, frames: number, rate: number, holdsFirst: boolean): void {
  const frame = Math.floor((at * rate) / QUANTUM) * QUANTUM;
  if (!(at >= 0) || frame >= frames || (holdsFirst && frame === 0)) {
    throw new RangeError(
      `renderEngineStereo: later.at ${at} s is outside the render`
      + (holdsFirst ? ', or inside its first quantum, where the worklet hold pauses' : ''),
    );
  }
}

/** `renderEngine`, both channels. With worklet voices it waits for the
 *  processor to load, and holds the render at its first frame until the
 *  processor has had its messages: an offline render does not wait for them.
 *  `later.run` is called with the render paused at `later.at` seconds; a
 *  `later.at` the render cannot pause at throws a `RangeError`, and an error
 *  `later.run` throws rejects the render once it has finished. */
export async function renderEngineStereo(
  seconds: number,
  play: (engine: AudioEngine) => void,
  rate = 48000,
  opts: Omit<AudioEngineOptions, 'context' | 'setTimer' | 'clearTimer'> = {},
  later?: { at: number; run: (engine: AudioEngine) => void },
): Promise<[Float32Array, Float32Array]> {
  const frames = Math.round(seconds * rate);
  const worklet = opts.synthVoices === 'worklet';
  if (later) requireLaterTime(later.at, frames, rate, worklet);
  const ctx = new OfflineAudioContext(2, frames, rate);
  Object.defineProperty(ctx, 'state', { configurable: true, get: () => 'running' });
  const engine = createAudioEngine({
    ...opts,
    context: ctx as unknown as AudioContext,
    setTimer: (cb, ms) => setTimeout(cb, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  });
  try {
    if (worklet) await engine.unlock();
    play(engine);
    await new Promise((r) => setTimeout(r, 0));
    // The render resumes whether or not `run` throws, or it never finishes and
    // the test times out instead of reporting the error.
    let failure: { error: unknown } | null = null;
    const paused = later
      ? ctx.suspend(later.at).then(async () => {
        try { later.run(engine); } catch (error) { failure = { error }; }
        await new Promise((r) => setTimeout(r, 50));
        await ctx.resume();
      })
      : Promise.resolve();
    let out: AudioBuffer;
    if (worklet) {
      const held = ctx.suspend(0);
      const rendering = ctx.startRendering();
      await held;
      await new Promise((r) => setTimeout(r, 50));
      await ctx.resume();
      out = await rendering;
    } else {
      out = await ctx.startRendering();
    }
    await paused;
    if (failure) throw (failure as { error: unknown }).error;
    return [out.getChannelData(0), out.getChannelData(1)];
  } finally {
    engine.dispose();
  }
}
