import { createAudioEngine, type AudioEngine } from '../createAudioEngine';

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
): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(2, Math.round(seconds * rate), rate);
  Object.defineProperty(ctx, 'state', { configurable: true, get: () => 'running' });
  const engine = createAudioEngine({
    context: ctx as unknown as AudioContext,
    setTimer: (cb, ms) => setTimeout(cb, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  });
  play(engine);
  await new Promise((r) => setTimeout(r, 0));
  const out = await ctx.startRendering();
  engine.dispose();
  return out.getChannelData(0);
}
