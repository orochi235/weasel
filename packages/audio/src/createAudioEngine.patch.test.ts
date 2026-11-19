import { afterEach, describe, expect, it } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import { engineHarness } from './testing/engineHarness';
import { createFakeAudioContext } from './testing/fakeAudioContext';
import { installFakeWorklet, type FakeWorklet } from './testing/fakeWorklet';
import { createNoiseKernel, createNoteKernel } from './voiceKernel';
import type { NoiseOptions, NoteOptions } from './types';

let installed: FakeWorklet | null = null;
afterEach(() => { installed?.restore(); installed = null; });

async function workletEngine() {
  const ctx = createFakeAudioContext();
  installed = installFakeWorklet(ctx);
  const engine = createAudioEngine({
    context: ctx as never, setTimer: () => 1, clearTimer: () => {}, synthVoices: 'worklet',
  });
  installed._load();
  await engine.unlock();
  return engine;
}

const badNotes: Partial<NoteOptions>[] = [
  { duration: Number.NaN }, { duration: -10 }, { duration: Number.POSITIVE_INFINITY },
  { envelope: { attack: Number.NaN } }, { envelope: { release: Number.POSITIVE_INFINITY } },
  { envelope: { sustain: Number.NaN } }, { envelope: { decay: Number.NaN } },
  { glide: { to: 'A5', ms: Number.NaN } }, { glide: { to: 'A5', ms: -5 } },
  { filter: { frequency: Number.NaN } }, { filter: { frequency: 800, Q: Number.NaN } },
  { filter: { frequency: 800, gain: Number.POSITIVE_INFINITY } },
  { filter: { frequency: 800, amount: Number.NaN, envelope: {} } },
  { filter: { frequency: 800, amount: 100, envelope: { attack: Number.NaN } } },
  { wave: { partials: [{ ratio: 1, gain: Number.NaN }] } },
  { wave: { partials: [{ ratio: 1, decay: Number.POSITIVE_INFINITY }] } },
];

const badNoises: Partial<NoiseOptions>[] = [
  { duration: Number.NaN }, { duration: -1 }, { envelope: { attack: Number.NaN } },
  { filter: { frequency: Number.NaN } },
];

describe('a synth patch number a voice could not play is refused at the call', () => {
  it('on nodes, books nothing', async () => {
    const { engine, ctx } = await engineHarness();
    for (const bad of badNotes) expect(() => engine.playNote({ pitch: 'A4', ...bad })).toThrow(RangeError);
    for (const bad of badNoises) expect(() => engine.playNoise({ noise: 'white', ...bad })).toThrow(RangeError);
    expect(engine.activeVoices()).toBe(0);
    expect(ctx._oscillators).toHaveLength(0);
  });

  it("under synthVoices: 'worklet', posts nothing", async () => {
    const engine = await workletEngine();
    for (const bad of badNotes) expect(() => engine.playNote({ pitch: 'A4', ...bad })).toThrow(RangeError);
    for (const bad of badNoises) expect(() => engine.playNoise({ noise: 'white', ...bad })).toThrow(RangeError);
    expect(installed!.nodes.flatMap((n) => n.posted)).toEqual([]);
  });

  it('in a kernel built outside an engine', () => {
    for (const bad of badNotes) expect(() => createNoteKernel({ pitch: 'A4', ...bad }, 48000)).toThrow(RangeError);
    for (const bad of badNoises) expect(() => createNoiseKernel({ noise: 'white', ...bad }, 48000)).toThrow(RangeError);
  });

  it('still takes a negative envelope time, read as 0', async () => {
    const { engine } = await engineHarness();
    expect(() => engine.playNote({ pitch: 'A4', duration: 0, envelope: { attack: -5 } })).not.toThrow();
  });
});

describe('a harmonic wave is refused at the call when it is empty or holds a level that is not finite', () => {
  const badWaves = [[], [1, Number.NaN], [Number.POSITIVE_INFINITY]];

  it('on nodes and in a kernel', async () => {
    const { engine, ctx } = await engineHarness();
    for (const wave of badWaves) {
      expect(() => engine.playNote({ pitch: 'A4', wave })).toThrow(RangeError);
      expect(() => createNoteKernel({ pitch: 'A4', wave }, 48000)).toThrow(RangeError);
    }
    expect(ctx._oscillators).toHaveLength(0);
  });

  it("under synthVoices: 'worklet'", async () => {
    const engine = await workletEngine();
    for (const wave of badWaves) expect(() => engine.playNote({ pitch: 'A4', wave })).toThrow(RangeError);
    expect(installed!.nodes.flatMap((n) => n.posted)).toEqual([]);
  });
});

describe('a voice rate of 0 or below is refused', () => {
  it('at the call and from a handle, on nodes, keeping the rate it had', async () => {
    const { engine, ctx, run } = await engineHarness();
    const sound = await engine.load('/a.wav');
    expect(() => engine.play(sound, { rate: 0 })).toThrow(RangeError);
    expect(() => engine.playNoise({ noise: 'white', rate: -1 })).toThrow(RangeError);
    const note = engine.playNote({ pitch: 'A4' });
    await run(25);
    expect(() => note.setRate(0)).toThrow(RangeError);
    expect(() => note.setRate(-1)).toThrow(RangeError);
    note.setDetune(100);
    expect(ctx._oscillators[0].detune.value).toBe(100);
  });

  it("under synthVoices: 'worklet', posts nothing", async () => {
    const engine = await workletEngine();
    expect(() => engine.playNoise({ noise: 'white', rate: -1 })).toThrow(RangeError);
    expect(installed!.nodes.flatMap((n) => n.posted)).toEqual([]);
  });

  it('in a kernel built outside an engine, and in its retune', () => {
    expect(() => createNoiseKernel({ noise: 'white', rate: -1 }, 48000)).toThrow(RangeError);
    const kernel = createNoiseKernel({ noise: 'white' }, 48000);
    expect(() => kernel.retune(0, 0)).toThrow(RangeError);
  });
});
