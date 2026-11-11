import { describe, expect, it } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import { createFakeAudioContext } from './testing/fakeAudioContext';

describe('an engine\'s voices, shrunk from the property tests', () => {
  it('refuses a NaN gain on the handle of a voice dropped by a disposed or locked engine, as on a live one', async () => {
    const ctx = createFakeAudioContext();
    const engine = createAudioEngine({ context: ctx as never, setTimer: () => 1, clearTimer: () => {} });
    const locked = engine.playNote({ pitch: 440 });
    expect(() => locked.setGain(NaN)).toThrow(RangeError);
    await engine.unlock();
    engine.dispose();
    const gone = engine.playNote({ pitch: 440 });
    expect(() => gone.setGain(NaN)).toThrow(RangeError);
    expect(() => gone.stop(Infinity)).toThrow(RangeError);
    expect(() => gone.setPosition({ x: NaN, y: 0 })).toThrow(RangeError);
    expect(() => gone.setGain(0.5)).not.toThrow();
  });
});
