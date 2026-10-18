import { describe, expect, it } from 'vitest';
import { renderNoise, renderNote } from '../voiceKernel';
import { loadVoiceProcessor } from './loadVoiceProcessor';
import { VOICE_PROCESSOR, type FromProcessor, type ToProcessor } from './protocol';

// The generated processor in a real worklet scope: it loads from source text,
// and mixes what the kernel renders, sample for sample.

const RATE = 48000;

async function render(seconds: number, events: ToProcessor[]) {
  const ctx = new OfflineAudioContext(2, Math.round(seconds * RATE), RATE);
  await loadVoiceProcessor(ctx);
  const node = new AudioWorkletNode(ctx, VOICE_PROCESSOR, {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
  });
  const ended: number[] = [];
  node.port.onmessage = (e: MessageEvent<FromProcessor>) => { ended.push(e.data.id); };
  node.connect(ctx.destination);
  // The port delivers on the audio thread's own turn, which an offline render
  // does not wait for: hold the render at its first frame until they are in.
  const held = ctx.suspend(0);
  const rendering = ctx.startRendering();
  await held;
  for (const event of events) node.port.postMessage(event);
  await new Promise((r) => setTimeout(r, 50));
  await ctx.resume();
  const out = await rendering;
  await new Promise((r) => setTimeout(r, 50));
  return { left: out.getChannelData(0), right: out.getChannelData(1), ended };
}

describe('the voice processor in an AudioWorklet', () => {
  it('loads from its generated source and plays a note as the kernel renders it', async () => {
    const patch = { pitch: 'A4', duration: 100, envelope: { attack: 5, release: 20 } };
    const at = 0.01;
    const { left, right, ended } = await render(0.2, [
      { kind: 'note', id: 7, at, level: 0.8, pan: 0, rate: 1, detune: 0, patch },
    ]);
    const kernel = renderNote(patch, RATE);
    const start = Math.round(at * RATE);
    expect(left.subarray(0, start).every((v) => v === 0)).toBe(true);
    let worst = 0;
    for (let i = 0; i < kernel.length; i += 1) {
      worst = Math.max(worst, Math.abs(left[start + i] - kernel[i] * 0.8 * Math.SQRT1_2));
    }
    expect(worst).toBeLessThan(1e-6);
    expect(right).toEqual(left);
    expect(left.subarray(start + kernel.length).every((v) => v === 0)).toBe(true);
    expect(ended).toEqual([7]);
  });

  it('plays noise from the seed it was sent', async () => {
    const patch = { noise: 'pink' as const, duration: 50 };
    const { left } = await render(0.1, [
      { kind: 'noise', id: 1, at: 0, level: 1, pan: -1, rate: 1, detune: 0, patch, seed: 0.25 },
    ]);
    const kernel = renderNoise(patch, RATE, () => 0.25);
    for (let i = 0; i < kernel.length; i += 97) expect(left[i]).toBeCloseTo(kernel[i], 6);
  });
});
