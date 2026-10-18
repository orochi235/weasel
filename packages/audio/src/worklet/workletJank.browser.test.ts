import { afterEach, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createAudioEngine, type AudioEngine } from '../createAudioEngine';
import type { AudioEngineOptions } from '../types';

// A real, running AudioContext, and a main thread blocked for most of a bar of
// booked notes. The worklet has to sound every one of them on time; the node
// engine, as the control, cannot, which is what shows the block was real.

const RATE = 48000;
const NOTES = 8;
const STEP = 0.1;
const LEAD = 0.1;
const BLOCK_MS = 900;
const RECORD = LEAD + NOTES * STEP + 0.1;

// Copies its input to its output and records `frames` of it, from the frame it
// is sent, into one buffer it posts back when full.
const RECORDER = `
class Recorder extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.buf = new Float32Array(options.processorOptions.frames);
    this.from = -1;
    this.sent = false;
    this.port.onmessage = (e) => { this.from = e.data; };
  }
  process(inputs, outputs) {
    const input = inputs[0][0];
    if (input && outputs[0][0]) outputs[0][0].set(input);
    if (this.from < 0 || this.sent) return true;
    for (let i = 0; input && i < input.length; i += 1) {
      const f = currentFrame + i - this.from;
      if (f >= 0 && f < this.buf.length) this.buf[f] = input[i];
    }
    if (currentFrame + 128 - this.from >= this.buf.length) {
      this.sent = true;
      this.port.postMessage(this.buf);
    }
    return true;
  }
}
registerProcessor('weasel-test-recorder', Recorder);
`;

const contexts: AudioContext[] = [];
const engines: AudioEngine[] = [];
afterEach(async () => {
  for (const e of engines.splice(0)) e.dispose();
  for (const c of contexts.splice(0)) await c.close();
});

function block(ms: number): void {
  const end = performance.now() + ms;
  let spin = 0;
  while (performance.now() < end) spin += 1;
  expect(spin).toBeGreaterThan(0);
}

/** An engine on a running context whose master output is recorded from
 *  inside a worklet: `record(from)` resolves with `RECORD` seconds of it,
 *  starting at context time `from`. */
async function recordedEngine(synthVoices: AudioEngineOptions['synthVoices']) {
  await userEvent.click(document.body);
  const ctx = new AudioContext({ sampleRate: RATE });
  contexts.push(ctx);
  await ctx.resume();
  const url = URL.createObjectURL(new Blob([RECORDER], { type: 'text/javascript' }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const recorder = new AudioWorkletNode(ctx, 'weasel-test-recorder', {
    numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
    processorOptions: { frames: Math.round(RECORD * RATE) },
  });
  recorder.connect(ctx.destination);
  // The engine wires its master to whatever `destination` it finds.
  Object.defineProperty(ctx, 'destination', { value: recorder });

  const late: number[] = [];
  const engine = createAudioEngine({ context: ctx, synthVoices, onLate: (ms) => late.push(ms) });
  engines.push(engine);
  await engine.unlock();
  // A clock that is not moving would pass nothing; wait until it does.
  const t0 = ctx.currentTime;
  await expect.poll(() => ctx.currentTime).toBeGreaterThan(t0 + 0.05);
  const record = (from: number) => {
    const recording = new Promise<Float32Array>((resolve) => {
      recorder.port.onmessage = (e: MessageEvent<Float32Array>) => resolve(e.data);
    });
    recorder.port.postMessage(Math.round(from * RATE));
    return recording;
  };
  return { ctx, engine, late, record };
}

/** Book a bar of notes, block the main thread through most of it, and return
 *  what the engine's master put out, from just before the first note. */
async function bookThenBlock(synthVoices: AudioEngineOptions['synthVoices']) {
  const { ctx, engine, late, record } = await recordedEngine(synthVoices);
  const from = ctx.currentTime + 0.1;
  const recording = record(from);
  // A plain callback at the first note's time: its lateness is the stall's.
  engine.schedule((from + LEAD) * 1000, () => {});
  for (let k = 0; k < NOTES; k += 1) {
    engine.playNote({
      pitch: 880, gain: 0.5, duration: 40, envelope: { attack: 2, release: 5 },
      when: (from + LEAD + k * STEP) * 1000,
    });
  }
  block(BLOCK_MS);
  return { samples: await recording, late };
}

/** Where each booked note's sound begins, in ms from where it was booked
 *  for, or null where nothing sounded within half a step of it. */
function onsets(samples: Float32Array): (number | null)[] {
  const out: (number | null)[] = [];
  for (let k = 0; k < NOTES; k += 1) {
    const due = Math.round((LEAD + k * STEP) * RATE);
    const lo = due - Math.round((STEP / 2) * RATE);
    const hi = Math.min(samples.length, due + Math.round((STEP / 2) * RATE));
    let found: number | null = null;
    for (let i = lo; i < hi; i += 1) {
      if (Math.abs(samples[i]) > 0.01) {
        found = ((i - due) / RATE) * 1000;
        break;
      }
    }
    out.push(found);
  }
  return out;
}

it('sounds every booked worklet note on time through a blocked main thread', async () => {
  const { samples, late } = await bookThenBlock('worklet');
  const at = onsets(samples);
  for (const [k, ms] of at.entries()) {
    expect(ms, `note ${k}`).not.toBeNull();
    expect(Math.abs(ms!), `note ${k} onset, ms`).toBeLessThan(3);
  }
  // Nothing between the notes: each gap is silent where the last one ended.
  for (let k = 1; k < NOTES; k += 1) {
    const due = Math.round((LEAD + k * STEP) * RATE);
    const gap = samples.subarray(due - Math.round(0.04 * RATE), due - Math.round(0.001 * RATE));
    expect(Math.max(...gap.map(Math.abs)), `gap before note ${k}`).toBeLessThan(0.01);
  }
  // The scheduler reached the first note's time late — only the probe says
  // so, because the voices were not.
  expect(late).toHaveLength(1);
  expect(late[0]).toBeGreaterThan(300);
}, 20_000);

it('control: node voices booked into the same block start late', async () => {
  const { samples, late } = await bookThenBlock('nodes');
  const onTime = onsets(samples).filter((ms) => ms !== null && Math.abs(ms) < 3).length;
  expect(onTime).toBeLessThan(NOTES);
  expect(Math.max(0, ...late)).toBeGreaterThan(300);
}, 20_000);

it('releases, rather than cuts, a worklet voice released inside the stall that started it', async () => {
  const { ctx, engine, record } = await recordedEngine('worklet');
  const from = ctx.currentTime + 0.1;
  const recording = record(from);
  const dropped: string[] = [];
  const voice = engine.playNote({
    pitch: 440, gain: 0.5, envelope: { attack: 2, release: 300 },
    when: (from + LEAD) * 1000, onDrop: (r) => dropped.push(r),
  });
  // Through the voice's start, with no scheduler pass between: then release.
  block(500);
  const releasedAt = Math.round((ctx.currentTime - from) * RATE);
  voice.release();
  const samples = await recording;
  const level = (at: number) => {
    let sq = 0;
    const n = Math.round(0.02 * RATE);
    for (let i = at; i < at + n; i += 1) sq += samples[i] * samples[i];
    return Math.sqrt(sq / n);
  };
  const held = level(releasedAt - Math.round(0.05 * RATE));
  expect(held).toBeGreaterThan(0.1);
  // A 300 ms release from there: still a third of the way down 100 ms on, where a cut is silent.
  const after = releasedAt + Math.round(0.1 * RATE);
  expect(after + Math.round(0.02 * RATE)).toBeLessThan(samples.length);
  expect(level(after)).toBeGreaterThan(0.3 * held);
  expect(dropped).toEqual([]);
}, 20_000);
