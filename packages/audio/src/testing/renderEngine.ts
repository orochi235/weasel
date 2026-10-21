import { createAudioEngine, type AudioEngine } from '../createAudioEngine';
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

/** `renderEngine`, both channels. With worklet voices it waits for the
 *  processor to load, and holds the render at its first frame until the
 *  processor has had its messages: an offline render does not wait for them.
 *  `later.run` is called with the render paused at `later.at` seconds. */
export async function renderEngineStereo(
  seconds: number,
  play: (engine: AudioEngine) => void,
  rate = 48000,
  opts: Omit<AudioEngineOptions, 'context' | 'setTimer' | 'clearTimer'> = {},
  later?: { at: number; run: (engine: AudioEngine) => void },
): Promise<[Float32Array, Float32Array]> {
  const ctx = new OfflineAudioContext(2, Math.round(seconds * rate), rate);
  Object.defineProperty(ctx, 'state', { configurable: true, get: () => 'running' });
  const engine = createAudioEngine({
    ...opts,
    context: ctx as unknown as AudioContext,
    setTimer: (cb, ms) => setTimeout(cb, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  });
  if (opts.synthVoices === 'worklet') await engine.unlock();
  play(engine);
  await new Promise((r) => setTimeout(r, 0));
  if (later) {
    void ctx.suspend(later.at).then(async () => {
      later.run(engine);
      await new Promise((r) => setTimeout(r, 50));
      await ctx.resume();
    });
  }
  let out: AudioBuffer;
  if (opts.synthVoices === 'worklet') {
    const held = ctx.suspend(0);
    const rendering = ctx.startRendering();
    await held;
    await new Promise((r) => setTimeout(r, 50));
    await ctx.resume();
    out = await rendering;
  } else {
    out = await ctx.startRendering();
  }
  engine.dispose();
  return [out.getChannelData(0), out.getChannelData(1)];
}
