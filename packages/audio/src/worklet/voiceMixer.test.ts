import { describe, expect, it } from 'vitest';
import { createNoteKernel } from '../voiceKernel';
import type { ToProcessor } from './protocol';
import { createVoiceMixer } from './voiceMixer';

const RATE = 48000;
const BLOCK = 128;

function run(mixer: ReturnType<typeof createVoiceMixer>, blocks: number, from = 0) {
  const left = new Float32Array(blocks * BLOCK);
  const right = new Float32Array(blocks * BLOCK);
  const ended: { id: number; block: number }[] = [];
  for (let b = 0; b < blocks; b += 1) {
    const at = b * BLOCK;
    for (const id of mixer.render(left.subarray(at, at + BLOCK), right.subarray(at, at + BLOCK), from + at)) {
      ended.push({ id, block: b });
    }
  }
  return { left, right, ended };
}

const note = (over: Partial<Extract<ToProcessor, { kind: 'note' }>> = {}): ToProcessor => ({
  kind: 'note', id: 1, at: 0, level: 1, pan: 0, rate: 1, detune: 0,
  patch: { pitch: 440, duration: 20, envelope: { attack: 1, release: 5 } },
  ...over,
});

describe('createVoiceMixer', () => {
  it('starts a voice on the frame its time names, in the middle of a block', () => {
    const mixer = createVoiceMixer(RATE);
    mixer.receive(note({ at: 300 / RATE }), 0);
    const { left } = run(mixer, 4);
    expect(left.subarray(0, 301).every((v) => v === 0)).toBe(true);
    expect(left.subarray(301, 400).some((v) => v !== 0)).toBe(true);
  });

  it('pans a centered voice equally, at the kernel times its level and √½', () => {
    const mixer = createVoiceMixer(RATE);
    mixer.receive(note({ level: 0.5 }), 0);
    const { left, right } = run(mixer, 4);
    const kernel = new Float32Array(4 * BLOCK);
    createNoteKernel({ pitch: 440, duration: 20, envelope: { attack: 1, release: 5 } }, RATE).render(kernel);
    for (let i = 0; i < kernel.length; i += 1) {
      expect(left[i]).toBeCloseTo(kernel[i] * 0.5 * Math.SQRT1_2, 6);
      expect(right[i]).toBeCloseTo(left[i], 6);
    }
  });

  it('pans hard left and hard right', () => {
    const mixer = createVoiceMixer(RATE);
    mixer.receive(note({ pan: -1 }), 0);
    mixer.receive(note({ id: 2, pan: 1, patch: { pitch: 660, duration: 20 } }), 0);
    const { left, right } = run(mixer, 2);
    const kernel = new Float32Array(2 * BLOCK);
    createNoteKernel({ pitch: 440, duration: 20, envelope: { attack: 1, release: 5 } }, RATE).render(kernel);
    for (let i = 0; i < kernel.length; i += 1) expect(left[i]).toBeCloseTo(kernel[i], 6);
    expect(right.some((v) => v !== 0)).toBe(true);
  });

  it('ramps a level linearly to its end time', () => {
    const mixer = createVoiceMixer(RATE);
    mixer.receive({ ...note(), patch: { pitch: 1, duration: 1000, envelope: { attack: 0 } } } as ToProcessor, 0);
    // A 1 Hz sine is nearly flat over a few blocks, so the output is the level.
    mixer.receive({ kind: 'level', id: 1, value: 0, end: (4 * BLOCK) / RATE }, 0);
    const flat = new Float32Array(8 * BLOCK);
    createNoteKernel({ pitch: 1, duration: 1000, envelope: { attack: 0 } }, RATE).render(flat);
    const { left } = run(mixer, 8);
    for (const i of [0, BLOCK, 2 * BLOCK, 3 * BLOCK]) {
      expect(left[i]).toBeCloseTo(flat[i] * Math.SQRT1_2 * (1 - i / (4 * BLOCK)), 6);
    }
    expect(left.subarray(4 * BLOCK).every((v) => v === 0)).toBe(true);
  });

  it('stops a voice at its stop time and reports it ended in that block', () => {
    const mixer = createVoiceMixer(RATE);
    mixer.receive(note({ patch: { pitch: 440 } }), 0);
    mixer.receive({ kind: 'stop', id: 1, at: 200 / RATE }, 0);
    const { left, ended } = run(mixer, 4);
    expect(left.subarray(100, 200).some((v) => v !== 0)).toBe(true);
    expect(left.subarray(200).every((v) => v === 0)).toBe(true);
    expect(ended).toEqual([{ id: 1, block: 1 }]);
    expect(mixer.size()).toBe(0);
  });

  it('never sounds a voice stopped before it starts', () => {
    const mixer = createVoiceMixer(RATE);
    mixer.receive(note({ at: 1000 / RATE }), 0);
    mixer.receive({ kind: 'stop', id: 1, at: 0 }, 0);
    const { left, ended } = run(mixer, 10);
    expect(left.every((v) => v === 0)).toBe(true);
    expect(ended).toEqual([{ id: 1, block: 0 }]);
  });

  it('reports a voice ended once its release is out', () => {
    const mixer = createVoiceMixer(RATE);
    mixer.receive(note(), 0);
    // 20 ms gate + 5 ms release = 1200 frames: the tenth block.
    const { ended } = run(mixer, 12);
    expect(ended.map((e) => e.id)).toEqual([1]);
    expect(ended[0].block).toBe(Math.floor(1200 / BLOCK));
  });

  it('releases a held voice from where it is', () => {
    const mixer = createVoiceMixer(RATE);
    mixer.receive(note({ patch: { pitch: 440, envelope: { attack: 1, release: 5 } } }), 0);
    run(mixer, 4);
    mixer.receive({ kind: 'release', id: 1 }, 4 * BLOCK);
    const { left, ended } = run(mixer, 4, 4 * BLOCK);
    expect(left.subarray(0, 100).some((v) => v !== 0)).toBe(true);
    expect(left.subarray(240).every((v) => v === 0)).toBe(true);
    expect(ended.map((e) => e.id)).toEqual([1]);
  });

  it('drops every voice on dispose', () => {
    const mixer = createVoiceMixer(RATE);
    mixer.receive(note(), 0);
    mixer.receive({ kind: 'dispose' }, 0);
    expect(mixer.size()).toBe(0);
    expect(run(mixer, 2).left.every((v) => v === 0)).toBe(true);
  });
});
