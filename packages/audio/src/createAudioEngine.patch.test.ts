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
