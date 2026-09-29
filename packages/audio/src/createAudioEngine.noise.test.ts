import { describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import { createPatternPlayer } from './patternPlayer';
import { noiseSamples } from './synthVoice';
import {
  createFakeAudioContext,
  type FakeAudioContext, type FakeBiquad, type FakeGain, type FakeNode, type FakePanner,
} from './testing/fakeAudioContext';

async function harness(ctx: FakeAudioContext = createFakeAudioContext()) {
  let pass: (() => void) | null = null;
  const engine = createAudioEngine({
    context: ctx as never,
    setTimer: (cb) => { pass = cb; return 1; },
    clearTimer: () => { pass = null; },
  });
  await engine.unlock();
  return { ctx, engine, tick: () => pass?.() };
}

/** The first node downstream of `from` of the given kind. */
function downstream(from: FakeNode, kind: string): FakeNode {
  let n: FakeNode | undefined = from.connectedTo[0];
  while (n && n.kind !== kind) n = n.connectedTo[0];
  if (!n) throw new Error(`no ${kind} downstream`);
  return n;
}

describe('engine.playNoise', () => {
  it('loops a generated noise buffer from a point inside it, through its envelope to the chain', async () => {
    const { ctx, engine, tick } = await harness();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.25);
    engine.playNoise({ noise: 'pink', when: 20 });
    tick();
    random.mockRestore();
    const [source] = ctx._sources;
    expect(source.loop).toBe(true);
    expect(source.started).toEqual([0.02]);
    const buffer = source.buffer as { duration: number; getChannelData(c: number): Float32Array };
    expect(source.offsets[0]).toBeCloseTo(buffer.duration / 4, 9);
    expect([...buffer.getChannelData(0)]).toEqual([...noiseSamples('pink', buffer.getChannelData(0).length)]);
    const env = source.connectedTo[0] as FakeGain;
    expect(env.kind).toBe('gain');
    expect((env.connectedTo[0] as FakePanner).kind).toBe('panner');
  });

  it('makes one buffer per color per context, shared across voices and engines', async () => {
    const { ctx, engine, tick } = await harness();
    const other = (await harness(ctx)).engine;
    engine.playNoise({ noise: 'white' });
    engine.playNoise({ noise: 'white' });
    other.playNoise({ noise: 'white' });
    engine.playNoise({ noise: 'brown' });
    tick();
    await Promise.resolve();
    expect(ctx._sources).toHaveLength(4);
    expect(new Set(ctx._sources.map((s) => s.buffer)).size).toBe(2);
    expect(ctx._buffers).toHaveLength(2);
  });

  it('runs the envelope from its start and stops the source after the release', async () => {
    const { ctx, engine, tick } = await harness();
    engine.playNoise({
      noise: 'white', when: 100, duration: 50, envelope: { attack: 2, release: 40 },
    });
    tick();
    const [source] = ctx._sources;
    const env = source.connectedTo[0] as FakeGain;
    expect(env.gain.holds).toEqual([{ value: 0, at: 0.1 }]);
    expect(env.gain.ramps.map((r) => r.value)).toEqual([1, 1, 0]);
    expect(env.gain.ramps.at(-1)!.at).toBeCloseTo(0.19, 9);
    expect(source.stopped).toEqual([expect.closeTo(0.19, 9)]);
  });

  it('is a voice like any other: slot, onDone, cancelKey', async () => {
    const { ctx, engine, tick } = await harness();
    const onDone = vi.fn();
    engine.playNoise({ noise: 'white', duration: 10, envelope: { release: 10 }, onDone });
    const held = engine.playNoise({ noise: 'white', cancelKey: 'hiss' });
    tick();
    expect(engine.activeVoices()).toBe(2);
    ctx._advance(25);
    expect(onDone).toHaveBeenCalledTimes(1);
    engine.stopKey('hiss');
    expect(held.isPlaying()).toBe(false);
    expect(engine.activeVoices()).toBe(0);
  });

  it('holds with no duration, and release() runs the release from its level', async () => {
    const { ctx, engine, tick } = await harness();
    const voice = engine.playNoise({ noise: 'white', envelope: { attack: 100, release: 40 } });
    tick();
    const [source] = ctx._sources;
    const env = source.connectedTo[0] as FakeGain;
    ctx._advance(50);
    expect(source.stopped).toEqual([]);
    voice.release();
    expect(env.gain.holds.at(-1)!.value).toBeCloseTo(0.5, 9);
    expect(env.gain.ramps.at(-1)).toEqual({ value: 0, at: expect.closeTo(0.09, 9) });
    expect(source.stopped.at(-1)).toBeCloseTo(0.09, 9);
  });

  it('retunes the buffer with rate and detune, and leaves the filter alone', async () => {
    const { ctx, engine, tick } = await harness();
    const voice = engine.playNoise({ noise: 'brown', rate: 2, detune: 30, filter: { frequency: 500 } });
    tick();
    const [source] = ctx._sources;
    expect(source.playbackRate.value).toBe(2);
    expect(source.detune.value).toBe(30);
    voice.setDetune(-100);
    expect(source.detune.value).toBe(-100);
    expect(ctx._filters[0].detune.value).toBe(0);
  });
});

describe('voice filters', () => {
  it('puts the filter between the source and the envelope', async () => {
    const { ctx, engine, tick } = await harness();
    engine.playNoise({ noise: 'white', filter: { type: 'highpass', frequency: 4000, Q: 3 } });
    tick();
    const filter = ctx._sources[0].connectedTo[0] as FakeBiquad;
    expect(filter.kind).toBe('biquad');
    expect(filter.type).toBe('highpass');
    expect(filter.frequency.holds).toEqual([{ value: 4000, at: 0 }]);
    expect(filter.Q.holds).toEqual([{ value: 3, at: 0 }]);
    expect(filter.connectedTo[0].kind).toBe('gain');
    expect(downstream(filter, 'panner').kind).toBe('panner');
  });

  it('sweeps the cutoff along its own envelope, offset by the amount', async () => {
    const { ctx, engine, tick } = await harness();
    engine.playNoise({
      noise: 'white', when: 100, duration: 100,
      filter: {
        frequency: 80, amount: 2000,
        envelope: { attack: 0, decay: 40, sustain: 0.25, release: 20 },
      },
    });
    tick();
    const f = ctx._filters[0].frequency;
    expect(f.holds).toEqual([{ value: 2080, at: 0.1 }]);
    expect(f.ramps.map((r) => r.value)).toEqual([580, 580, 80]);
    expect(f.ramps.map((r) => r.at)).toEqual([0.14, 0.2, 0.22].map((t) => expect.closeTo(t, 9)));
  });

  it('releases the cutoff envelope with the note', async () => {
    const { ctx, engine, tick } = await harness();
    const voice = engine.playNote({
      pitch: 220,
      filter: { frequency: 100, amount: 1000, envelope: { attack: 100, release: 50 } },
    });
    tick();
    ctx._advance(50);
    voice.release();
    const f = ctx._filters[0].frequency;
    expect(f.cancels.at(-1)).toBeCloseTo(0.05, 9);
    expect(f.holds.at(-1)!.value).toBeCloseTo(600, 6);
    expect(f.ramps.at(-1)).toEqual({ value: 100, at: expect.closeTo(0.1, 9) });
  });

  it('filters an oscillator voice too', async () => {
    const { ctx, engine, tick } = await harness();
    engine.playNote({ pitch: 110, wave: 'sawtooth', filter: { frequency: 900 } });
    tick();
    expect(ctx._oscillators[0].connectedTo[0]).toBe(ctx._filters[0]);
  });
});

describe('inharmonic notes', () => {
  const partials = [
    { ratio: 1, gain: 2, decay: 100 },
    { ratio: 1.71, gain: 1 },
    { ratio: 2.43, gain: 1, decay: 40 },
  ];

  it('sums one sine per partial at its ratio, each through its own normalized level', async () => {
    const { ctx, engine, tick } = await harness();
    engine.playNote({ pitch: 200, when: 10, wave: { partials } });
    tick();
    const oscs = ctx._oscillators;
    expect(oscs.map((o) => o.type)).toEqual(['sine', 'sine', 'sine']);
    expect(oscs.map((o) => o.frequency.holds[0].value)).toEqual([200, 342, 486].map((f) => expect.closeTo(f, 9)));
    const levels = oscs.map((o) => o.connectedTo[0] as FakeGain);
    expect(levels.map((l) => l.gain.holds[0].value)).toEqual([0.5, 0.25, 0.25]);
    expect(levels.map((l) => l.gain.targets)).toEqual([
      [{ value: 0, at: 0.01, timeConstant: 0.1 }],
      [],
      [{ value: 0, at: 0.01, timeConstant: 0.04 }],
    ]);
    const env = levels[0].connectedTo[0];
    expect(levels.every((l) => l.connectedTo[0] === env)).toBe(true);
    expect(oscs.every((o) => o.started[0] === 0.01)).toBe(true);
  });

  it('glides every partial by the same interval', async () => {
    const { ctx, engine, tick } = await harness();
    engine.playNote({ pitch: 100, duration: 50, wave: { partials }, glide: { to: 50 } });
    tick();
    expect(ctx._oscillators.map((o) => o.frequency.expRamps[0].value))
      .toEqual([50, 85.5, 121.5].map((f) => expect.closeTo(f, 9)));
  });

  it('detunes, stops and releases every partial together, and ends as one voice', async () => {
    const { ctx, engine, tick } = await harness();
    const onDone = vi.fn();
    const voice = engine.playNote({
      pitch: 100, wave: { partials }, envelope: { release: 20 }, detune: 10, onDone,
    });
    tick();
    const oscs = ctx._oscillators;
    voice.setDetune(-50);
    expect(oscs.map((o) => o.detune.value)).toEqual([-50, -50, -50]);
    ctx._advance(10);
    voice.release();
    expect(oscs.map((o) => o.stopped.at(-1))).toEqual([0.03, 0.03, 0.03].map((t) => expect.closeTo(t, 9)));
    ctx._advance(30);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(engine.activeVoices()).toBe(0);
    expect(oscs.every((o) => o.connectedTo.length === 0)).toBe(true);
  });

  it('stops every partial when the voice is stolen or stopped', async () => {
    const { ctx, engine, tick } = await harness();
    const voice = engine.playNote({ pitch: 100, wave: { partials } });
    tick();
    voice.stop();
    expect(ctx._oscillators.every((o) => o.stopped.length === 1)).toBe(true);
  });

  it('rejects a bad partial where the note was written', async () => {
    const { engine } = await harness();
    expect(() => engine.playNote({ pitch: 100, wave: { partials: [] } })).toThrow(/at least one partial/);
    expect(() => engine.playNote({ pitch: 100, wave: { partials: [{ ratio: 0 }] } })).toThrow(/ratio/);
    expect(() => engine.playNote({ pitch: 100, wave: { partials: [{ ratio: 1, decay: -1 }] } })).toThrow(/decay/);
  });
});

describe('noiseSamples', () => {
  it('is repeatable, has no DC, sits at one RMS for every color and meets itself at the loop', () => {
    for (const color of ['white', 'pink', 'brown'] as const) {
      const a = noiseSamples(color, 48000);
      expect([...a.slice(0, 64)], color).toEqual([...noiseSamples(color, 48000).slice(0, 64)]);
      let sum = 0, sq = 0, step = 0;
      for (let i = 0; i < a.length; i += 1) {
        sum += a[i];
        sq += a[i] * a[i];
        if (i > 0) step += Math.abs(a[i] - a[i - 1]);
      }
      expect(Math.abs(sum / a.length), color).toBeLessThan(1e-6);
      expect(Math.sqrt(sq / a.length), color).toBeCloseTo(0.25, 5);
      // The wrap is no bigger a jump than the signal's own typical step.
      expect(Math.abs(a[0] - a[a.length - 1]), color).toBeLessThan(2 * (step / (a.length - 1)));
    }
  });
});

describe('pattern noise events', () => {
  it('books noise on its step with a gate of its length', async () => {
    const { ctx, engine } = await harness();
    const player = createPatternPlayer(engine, {
      tempo: 120,
      events: [{ step: 0, noise: 'white', length: 2, filter: { type: 'highpass', frequency: 6000 } }],
    });
    player.start(0);
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
    const [source] = ctx._sources;
    expect(source.loop).toBe(true);
    expect(ctx._filters[0].type).toBe('highpass');
    // Two sixteenths at 120 bpm is 250 ms, then the default 30 ms release.
    expect(source.stopped[0]).toBeCloseTo(0.28, 9);
  });
});
