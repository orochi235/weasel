import { expect, it, vi } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import { createFakeAudioContext, type FakeGain } from './testing/fakeAudioContext';

it('frees the slot and the chain of a voice whose node fails to start', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const ctx = createFakeAudioContext();
  let pass: (() => void) | null = null;
  const engine = createAudioEngine({
    context: ctx as never,
    setTimer: (cb) => { pass = cb; return 1; },
    clearTimer: () => { pass = null; },
    fetchFn: (async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as never,
  });
  await engine.unlock();
  const sound = await engine.load('/a.wav');

  const createBufferSource = ctx.createBufferSource.bind(ctx);
  ctx.createBufferSource = () => {
    const source = createBufferSource();
    source.start = () => { throw new RangeError('start time is negative'); };
    return source;
  };

  const voice = engine.play(sound, { loop: true });
  pass!();

  expect(error).toHaveBeenCalled();
  expect(voice.isPlaying()).toBe(false);
  expect(engine.activeVoices()).toBe(0);
  const chainGain = ctx._sources[0].connectedTo[0].connectedTo[0] as FakeGain;
  expect(chainGain.connectedTo).toEqual([]);
  error.mockRestore();
});
