import { describe, expect, it } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import { createFakeAudioContext, type FakeGain, type FakePanner } from './testing/fakeAudioContext';

async function positionalVoice() {
  const ctx = createFakeAudioContext();
  let pass: (() => void) | null = null;
  const engine = createAudioEngine({
    context: ctx as never,
    setTimer: (cb) => { pass = cb; return 1; },
    clearTimer: () => { pass = null; },
    fetchFn: (async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as never,
  });
  await engine.unlock();
  engine.setListener({ x: 0, y: 0 });
  const sound = await engine.load('/a.wav');
  const voice = engine.play(sound, { position: { x: 0, y: 0 }, loop: true });
  pass!();
  const panner = ctx._sources[0].connectedTo[0] as FakePanner;
  return { ctx, engine, voice, panner, gain: (panner.connectedTo[0] as FakeGain).gain };
}

describe('a positional voice while the listener moves', () => {
  it('keeps its fade-out', async () => {
    const { ctx, engine, voice, panner, gain } = await positionalVoice();
    ctx._advance(500);
    voice.stop(200);
    const scheduled = { cancels: gain.cancels.length, holds: gain.holds.length };

    ctx._advance(16);
    engine.setListener({ x: 250, y: 0 });

    expect(gain.ramps).toEqual([{ value: 0, at: 0.7 }]);
    expect({ cancels: gain.cancels.length, holds: gain.holds.length }).toEqual(scheduled);
    expect(panner.pan.value).toBeCloseTo(-0.5, 6);
  });

  it('keeps a setGain ramp running to its end, toward the new level', async () => {
    const { ctx, engine, voice, gain } = await positionalVoice();
    voice.setGain(0.5, 200);
    expect(gain.ramps.at(-1)).toEqual({ value: 0.5, at: 0.2 });

    ctx._advance(50);
    engine.setListener({ x: 500, y: 0 });

    const last = gain.ramps.at(-1)!;
    expect(last.at).toBeCloseTo(0.2, 6);
    expect(last.value).toBeCloseTo(0.5 / 500, 6);
    expect(gain.holds.at(-1)!.value).not.toBeCloseTo(0.5 / 500, 6);
  });

  it('writes the level at once when no ramp is running', async () => {
    const { ctx, engine, voice, gain } = await positionalVoice();
    voice.setGain(0.5, 200);
    ctx._advance(300);
    engine.setListener({ x: 500, y: 0 });
    expect(gain.value).toBeCloseTo(0.5 / 500, 6);
  });
});
