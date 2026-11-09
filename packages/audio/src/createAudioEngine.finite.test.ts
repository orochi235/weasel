import { describe, expect, it } from 'vitest';
import { engineHarness } from './testing/engineHarness';

describe('createAudioEngine refuses a voice number that is not finite', () => {
  it('refuses a play whose gain, rate, detune, pan or position is not finite, and books nothing', async () => {
    const { engine, ctx } = await engineHarness();
    const sound = await engine.load('/a.wav');
    expect(() => engine.play(sound, { gain: Number.NaN })).toThrow(RangeError);
    expect(() => engine.play(sound, { rate: Number.POSITIVE_INFINITY })).toThrow(RangeError);
    expect(() => engine.playNote({ pitch: 220, detune: Number.NaN })).toThrow(RangeError);
    expect(() => engine.playNoise({ noise: 'white', pan: Number.NaN })).toThrow(RangeError);
    expect(() => engine.play(sound, { position: { x: Number.NaN, y: 0 } })).toThrow(RangeError);
    expect(() => engine.play(sound, { position: { x: 0, y: 0, z: Number.NaN } })).toThrow(RangeError);
    expect(engine.activeVoices()).toBe(0);
    expect(ctx._sources).toHaveLength(0);
  });

  it('refuses a non-finite rate, detune, pan or position on a voice and keeps what it had', async () => {
    const { engine, ctx, run } = await engineHarness();
    const sound = await engine.load('/a.wav');
    const voice = engine.play(sound, { loop: true, rate: 2, detune: 100, pan: 0.5 });
    await run(25);
    const source = ctx._sources[0];
    expect(() => voice.setRate(Number.NaN)).toThrow(RangeError);
    expect(() => voice.setDetune(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
    expect(() => voice.setPan(Number.NaN)).toThrow(RangeError);
    expect(() => voice.setPosition({ x: 0, y: Number.NaN })).toThrow(RangeError);
    voice.setDetune(200);
    expect(source.playbackRate.value).toBe(2);
    expect(source.detune.value).toBe(200);
  });

  it('refuses a listener that is not finite and keeps the one it had', async () => {
    const { engine } = await engineHarness();
    engine.setListener({ x: 0, y: 0 });
    expect(() => engine.setListener({ x: Number.NaN, y: 0 })).toThrow(RangeError);
    const sound = await engine.load('/a.wav');
    expect(() => engine.play(sound, { position: { x: 10, y: 0 } })).not.toThrow();
  });

  it('refuses listener options that are not finite and keeps the ones it had', async () => {
    const { engine, ctx, run } = await engineHarness();
    engine.setListener({ x: 0, y: 0 }, { refDistance: 1, panWidth: 100 });
    for (const bad of [
      { refDistance: Number.NaN }, { maxDistance: Number.POSITIVE_INFINITY }, { rolloffFactor: Number.NaN },
      { panWidth: Number.NaN }, { right: { x: Number.NaN, y: 0 } },
    ]) {
      expect(() => engine.setListener({ x: 0, y: 0 }, bad)).toThrow(RangeError);
    }
    const sound = await engine.load('/a.wav');
    engine.play(sound, { position: { x: 50, y: 0 } });
    await run(25);
    const panner = ctx._sources[0].connectedTo[0] as unknown as { pan: { value: number } };
    expect(panner.pan.value).toBe(0.5);
  });
});
