import { describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import {
  createFakeAudioContext,
  type FakeGain, type FakeOscillator, type FakePanner,
} from './testing/fakeAudioContext';

async function harness(over: Record<string, unknown> = {}) {
  const ctx = createFakeAudioContext();
  let pass: (() => void) | null = null;
  const engine = createAudioEngine({
    context: ctx as never,
    setTimer: (cb) => { pass = cb; return 1; },
    clearTimer: () => { pass = null; },
    fetchFn: (async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as never,
    ...over,
  });
  await engine.unlock();
  return { ctx, engine, tick: () => pass?.() };
}

/** oscillator → envelope gain → panner → gain → bus, the chain `playNote()` builds. */
function chainOf(osc: FakeOscillator) {
  const env = osc.connectedTo[0] as FakeGain;
  const panner = env.connectedTo[0] as FakePanner;
  const gain = panner.connectedTo[0] as FakeGain;
  return { env, panner, gain, bus: gain.connectedTo[0] as FakeGain };
}

describe('engine.playNote', () => {
  it('starts an oscillator at the named pitch and the booked time, through its own envelope', async () => {
    const { ctx, engine, tick } = await harness();
    engine.playNote({ pitch: 'A4', when: 50 });
    tick();
    expect(ctx._oscillators).toHaveLength(1);
    const osc = ctx._oscillators[0];
    expect(osc.frequency.holds[0]).toEqual({ value: 440, at: 0.05 });
    expect(osc.started).toEqual([0.05]);
    const { env, panner, gain } = chainOf(osc);
    expect(env.kind).toBe('gain');
    expect(panner.kind).toBe('panner');
    expect(gain.kind).toBe('gain');
  });

  it('routes to the bus it names', async () => {
    const { ctx, engine, tick } = await harness();
    engine.playNote({ pitch: 220, bus: 'music' });
    engine.play(await engine.load('/a.wav'), { bus: 'music' });
    tick();
    const sourceBus = ctx._sources[0].connectedTo[0].connectedTo[0].connectedTo[0];
    expect(chainOf(ctx._oscillators[0]).bus).toBe(sourceBus);
  });

  it('uses a built-in wave by name', async () => {
    const { ctx, engine, tick } = await harness();
    engine.playNote({ pitch: 220, wave: 'square' });
    tick();
    expect(ctx._oscillators[0].type).toBe('square');
    expect(ctx._oscillators[0].periodicWave).toBeNull();
  });

  it('builds harmonic partials into a periodic wave, and reuses it', async () => {
    const { ctx, engine, tick } = await harness();
    engine.playNote({ pitch: 220, wave: [1, 0.5, 0.25] });
    engine.playNote({ pitch: 330, wave: [1, 0.5, 0.25] });
    tick();
    const [a, b] = ctx._oscillators;
    expect([...a.periodicWave!.imag]).toEqual([0, 1, 0.5, 0.25]);
    expect([...a.periodicWave!.real]).toEqual([0, 0, 0, 0]);
    expect(b.periodicWave).toBe(a.periodicWave);
  });

  it('schedules the envelope from the start time and stops after the release', async () => {
    const { ctx, engine, tick } = await harness();
    engine.playNote({
      pitch: 220, when: 100, duration: 200,
      envelope: { attack: 10, decay: 20, sustain: 0.5, release: 50 },
    });
    tick();
    const osc = ctx._oscillators[0];
    const { env } = chainOf(osc);
    expect(env.gain.holds).toEqual([{ value: 0, at: 0.1 }]);
    expect(env.gain.ramps.map((r) => r.value)).toEqual([1, 0.5, 0.5, 0]);
    expect(env.gain.ramps.map((r) => r.at)).toEqual([0.11, 0.13, 0.3, 0.35].map((t) => expect.closeTo(t, 9)));
    expect(osc.stopped).toEqual([expect.closeTo(0.35, 9)]);
  });

  it('frees its slot and calls onDone when the oscillator ends', async () => {
    const { ctx, engine, tick } = await harness();
    const onDone = vi.fn();
    const voice = engine.playNote({ pitch: 220, duration: 100, envelope: { release: 20 }, onDone });
    tick();
    const { env } = chainOf(ctx._oscillators[0]);
    expect(engine.activeVoices()).toBe(1);
    ctx._advance(130);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(engine.activeVoices()).toBe(0);
    expect(voice.isPlaying()).toBe(false);
    expect(env.connectedTo).toEqual([]);
  });

  it('holds a note with no duration until it is released, then runs the release from its level', async () => {
    const { ctx, engine, tick } = await harness();
    const voice = engine.playNote({
      pitch: 220, envelope: { attack: 100, sustain: 1, release: 40 },
    });
    tick();
    const osc = ctx._oscillators[0];
    const { env } = chainOf(osc);
    ctx._advance(50);
    expect(osc.stopped).toEqual([]);
    voice.release();
    expect(env.gain.cancels.at(-1)).toBeCloseTo(0.05, 9);
    expect(env.gain.holds.at(-1)).toEqual({ value: expect.closeTo(0.5, 9), at: expect.closeTo(0.05, 9) });
    expect(env.gain.ramps.at(-1)).toEqual({ value: 0, at: expect.closeTo(0.09, 9) });
    expect(osc.stopped.at(-1)).toBeCloseTo(0.09, 9);
    expect(voice.isPlaying()).toBe(true);
    ctx._advance(50);
    expect(voice.isPlaying()).toBe(false);
  });

  it('releases a gated note early, from wherever it has got to', async () => {
    const { ctx, engine, tick } = await harness();
    const voice = engine.playNote({
      pitch: 220, duration: 1000, envelope: { attack: 0, sustain: 0.8, release: 10 },
    });
    tick();
    ctx._advance(100);
    voice.release();
    const osc = ctx._oscillators[0];
    expect(chainOf(osc).env.gain.holds.at(-1)?.value).toBeCloseTo(0.8, 9);
    expect(osc.stopped.at(-1)).toBeCloseTo(0.11, 9);
  });

  it('cancels a note released before it starts', async () => {
    const { ctx, engine, tick } = await harness();
    const voice = engine.playNote({ pitch: 220, when: 5_000 });
    voice.release();
    ctx._advance(5_000);
    tick();
    expect(ctx._oscillators).toHaveLength(0);
    expect(voice.isPlaying()).toBe(false);
  });

  it('stops a buffer voice on release, since it has no envelope', async () => {
    const { ctx, engine, tick } = await harness();
    const voice = engine.play(await engine.load('/a.wav'));
    tick();
    voice.release();
    expect(ctx._sources[0].stopped).toHaveLength(1);
    expect(voice.isPlaying()).toBe(false);
  });

  it('shares its bus pool with buffer voices, so either can steal the other', async () => {
    const { engine, tick } = await harness({ voiceLimit: 1 });
    const buffer = engine.play(await engine.load('/a.wav'));
    tick();
    const note = engine.playNote({ pitch: 220 });
    tick();
    expect(buffer.isPlaying()).toBe(false);
    expect(note.isPlaying()).toBe(true);
    expect(engine.activeVoices()).toBe(1);
  });

  it('stops with its cancelKey', async () => {
    const { ctx, engine, tick } = await harness();
    const voice = engine.playNote({ pitch: 220, cancelKey: 'lead' });
    engine.playNote({ pitch: 330, cancelKey: 'lead', when: 5_000 });
    tick();
    engine.stopKey('lead');
    ctx._advance(5_000);
    tick();
    expect(voice.isPlaying()).toBe(false);
    expect(ctx._oscillators).toHaveLength(1);
  });

  it('glides exponentially by default, over the note duration', async () => {
    const { ctx, engine, tick } = await harness();
    engine.playNote({ pitch: 200, duration: 160, glide: { to: 400 } });
    tick();
    const f = ctx._oscillators[0].frequency;
    expect(f.holds).toEqual([{ value: 200, at: 0 }]);
    expect(f.expRamps).toEqual([{ value: 400, at: expect.closeTo(0.16, 9) }]);
  });

  it('glides linearly on request, over the time it is given', async () => {
    const { ctx, engine, tick } = await harness();
    engine.playNote({ pitch: 200, duration: 160, glide: { to: 'A4', ms: 40, curve: 'linear' } });
    tick();
    const f = ctx._oscillators[0].frequency;
    expect(f.ramps).toEqual([{ value: 440, at: expect.closeTo(0.04, 9) }]);
    expect(f.expRamps).toEqual([]);
  });

  it('turns detune and rate into oscillator detune, before and after the start', async () => {
    const { ctx, engine, tick } = await harness();
    const voice = engine.playNote({ pitch: 220, detune: 50, when: 20 });
    voice.setRate(2);
    tick();
    const osc = ctx._oscillators[0];
    expect(osc.detune.value).toBeCloseTo(1250, 9);
    voice.setDetune(0);
    expect(osc.detune.value).toBeCloseTo(1200, 9);
  });

  it('drops a note before unlock, as play() does', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = createFakeAudioContext();
    const engine = createAudioEngine({
      context: ctx as never, setTimer: () => 1, clearTimer: () => {},
    });
    expect(engine.playNote({ pitch: 220 }).isPlaying()).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('engine.schedule', () => {
  it('fires a callback at its engine time, and stopKey cancels it', async () => {
    const { ctx, engine, tick } = await harness();
    const seen: number[] = [];
    engine.schedule(50, (when) => seen.push(when));
    engine.schedule(60, (when) => seen.push(when), 'k');
    engine.stopKey('k');
    tick();
    expect(seen).toEqual([50]);
    ctx._advance(1_000);
    tick();
    expect(seen).toEqual([50]);
  });

  it('books nothing after dispose', async () => {
    const { engine, tick } = await harness();
    engine.dispose();
    const fire = vi.fn();
    engine.schedule(0, fire);
    tick();
    await Promise.resolve();
    expect(fire).not.toHaveBeenCalled();
  });
});
