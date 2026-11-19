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

/** An offline render pauses only on a render quantum's boundary. */
const QUANTUM = 128;

/** `renderEngine`, both channels. With worklet voices it waits for the
 *  processor to load, and holds the render at its first frame until the
 *  processor has had its messages: an offline render does not wait for them.
 *  `later.run` is called with the render paused at `later.at` seconds, which
 *  must fall inside the render; with worklet voices, a `later.at` inside the
 *  first render quantum runs during that first hold, since a render cannot
 *  pause twice in one quantum. */
export async function renderEngineStereo(
  seconds: number,
  play: (engine: AudioEngine) => void,
  rate = 48000,
  opts: Omit<AudioEngineOptions, 'context' | 'setTimer' | 'clearTimer'> = {},
  later?: { at: number; run: (engine: AudioEngine) => void },
): Promise<[Float32Array, Float32Array]> {
  if (later && !(later.at >= 0 && later.at < seconds)) {
    throw new RangeError(`renderEngineStereo: later.at must fall inside the ${seconds} s render (got ${later.at})`);
  }
  const ctx = new OfflineAudioContext(2, Math.round(seconds * rate), rate);
  Object.defineProperty(ctx, 'state', { configurable: true, get: () => 'running' });
  const engine = createAudioEngine({
    ...opts,
    context: ctx as unknown as AudioContext,
    setTimer: (cb, ms) => setTimeout(cb, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  });
  const worklet = opts.synthVoices === 'worklet';
  if (worklet) await engine.unlock();
  play(engine);
  await new Promise((r) => setTimeout(r, 0));
  const pause = async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, 50));
    await ctx.resume();
  };
  const atHold = later !== undefined && worklet && later.at * rate < QUANTUM;
  // Held rather than `void`ed: a pause that fails fails the render with it.
  const laterDone = later && !atHold
    ? ctx.suspend(later.at).then(async () => { later.run(engine); await pause(); })
      .then(() => null, (error: unknown) => ({ error }))
    : null;
  let out: AudioBuffer;
  if (worklet) {
    const held = ctx.suspend(0);
    const rendering = ctx.startRendering();
    await held;
    if (atHold) later.run(engine);
    await pause();
    out = await rendering;
  } else {
    out = await ctx.startRendering();
  }
  const failed = await laterDone;
  engine.dispose();
  if (failed) throw failed.error;
  return [out.getChannelData(0), out.getChannelData(1)];
}
