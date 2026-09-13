import { describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import {
  createFakeAudioContext,
  type FakeGain, type FakePanner, type FakeSource,
} from './testing/fakeAudioContext';

function engineHarness(over: Record<string, unknown> = {}) {
  const ctx = createFakeAudioContext();
  let pass: (() => void) | null = null;
  const engine = createAudioEngine({
    context: ctx as never,
    setTimer: (cb) => { pass = cb; return 1; },
    clearTimer: () => { pass = null; },
    fetchFn: (async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as never,
    ...over,
  });
  return { ctx, engine, tick: () => pass?.() };
}

function chainOf(source: FakeSource) {
  const panner = source.connectedTo[0] as FakePanner;
  const gain = panner.connectedTo[0] as FakeGain;
  return { panner, gain };
}

describe('createAudioEngine voice chains', () => {
  it("reuses a stopped voice's gain and panner for the next play", async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const a = engine.play(sound, { loop: true });
    tick();
    const first = chainOf(ctx._sources[0]);
    a.stop();
    const createGain = vi.spyOn(ctx, 'createGain');
    const createPanner = vi.spyOn(ctx, 'createStereoPanner');
    engine.play(sound, { loop: true });
    tick();
    const second = chainOf(ctx._sources[1]);
    expect(second.gain).toBe(first.gain);
    expect(second.panner).toBe(first.panner);
    expect(createGain).not.toHaveBeenCalled();
    expect(createPanner).not.toHaveBeenCalled();
  });

  it('routes a reused chain to the bus of the voice now using it', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const a = engine.play(sound, { bus: 'music', loop: true });
    tick();
    const { gain } = chainOf(ctx._sources[0]);
    const music = gain.connectedTo[0];
    a.stop();
    expect(gain.connectedTo).toEqual([]);
    engine.play(sound, { bus: 'ui', loop: true });
    tick();
    expect(chainOf(ctx._sources[1]).gain).toBe(gain);
    expect(gain.connectedTo).toHaveLength(1);
    expect(gain.connectedTo[0]).not.toBe(music);
  });

  it("starts a reused chain at the new voice's gain and pan, canceling the last fade", async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const a = engine.play(sound, { loop: true, gain: 0.8, pan: -1 });
    tick();
    const { gain, panner } = chainOf(ctx._sources[0]);
    ctx._advance(100);
    a.stop(500);
    ctx._advance(100);
    engine.stopAll();                    // cut mid-fade, with the ramp still scheduled
    engine.play(sound, { loop: true, gain: 0.3, pan: 0.5 });
    tick();
    expect(chainOf(ctx._sources[1]).gain).toBe(gain);
    expect(gain.gain.cancels.at(-1)).toBeCloseTo(0.2, 6);
    expect(gain.gain.value).toBe(0.3);
    expect(panner.pan.value).toBe(0.5);
  });

  it("does not let a stopped voice's handle write to a chain another voice now uses", async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const a = engine.play(sound, { loop: true });
    tick();
    const first = chainOf(ctx._sources[0]);
    a.stop();
    const b = engine.play(sound, { loop: true, gain: 0.5, pan: -0.5 });
    tick();
    const { gain, panner } = chainOf(ctx._sources[1]);
    expect(gain).toBe(first.gain);
    const holds = gain.gain.holds.length;
    a.setGain(0.1);
    a.setGain(0.1, 50);
    a.setPan(1);
    a.setPosition({ x: 400, y: 0 });
    a.stop(300);
    expect(gain.gain.holds).toHaveLength(holds);
    expect(gain.gain.ramps).toEqual([]);
    expect(gain.gain.value).toBe(0.5);
    expect(panner.pan.value).toBe(-0.5);
    expect(ctx._sources[1].stopped).toEqual([]);
    expect(b.isPlaying()).toBe(true);
  });

  it("does not let a stolen voice's handle write to its chain once reissued", async () => {
    const { ctx, engine, tick } = engineHarness({ voiceLimit: 1, buses: ['only'] });
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const a = engine.play(sound, { loop: true });
    tick();
    const stolenChain = chainOf(ctx._sources[0]);
    engine.play(sound, { loop: true });
    tick();                              // steals a
    engine.play(sound, { loop: true, gain: 0.4 });
    tick();                              // steals b, on a's old chain
    const { gain } = chainOf(ctx._sources[2]);
    expect(gain).toBe(stolenChain.gain);
    a.setGain(0.9, 100);
    a.setPan(1);
    expect(gain.gain.value).toBe(0.4);
    expect(gain.gain.ramps).toEqual([]);
    expect(stolenChain.panner.pan.value).toBe(0);
  });

  it('keeps no more idle chains than the engine has voice slots', async () => {
    const { ctx, engine } = engineHarness({ voiceLimit: 1, buses: ['only'] });
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    // Booked voices hold a chain but no slot, so three can be alive at once.
    for (let i = 0; i < 3; i += 1) engine.play(sound, { when: 60_000 });
    engine.stopAll();
    const createGain = vi.spyOn(ctx, 'createGain');
    for (let i = 0; i < 3; i += 1) engine.play(sound, { when: 60_000 });
    expect(createGain).toHaveBeenCalledTimes(2);
  });
});
