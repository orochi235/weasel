import { describe, expect, it, vi } from 'vitest';
import { periodicWave } from '../periodicWave';
import { noiseBuffer } from '../synthVoice';
import { createFakeAudioContext } from '../testing/fakeAudioContext';
import { createFileSourceNode, createNoiseNode, createOscillatorNode } from './sources';

const setup = () => {
  const ctx = createFakeAudioContext();
  ctx.state = 'running';
  return ctx;
};

describe('file source', () => {
  it('loops by default and restarts on each start', () => {
    const ctx = setup();
    const buffer = ctx.createBuffer(1, 100, 100);
    const node = createFileSourceNode(ctx as never, { buffer: buffer as never });
    node.start!(0);
    node.stop!(1);
    node.start!(2);
    expect(ctx._sources).toHaveLength(2);
    for (const s of ctx._sources) {
      expect(s.loop).toBe(true);
      expect(s.buffer).toBe(buffer);
      expect(s.connectedTo).toContain(node.output);
    }
  });

  it('resumes where it stopped', () => {
    const ctx = setup();
    const buffer = ctx.createBuffer(1, 200, 100);
    const node = createFileSourceNode(ctx as never, { buffer: buffer as never });
    node.start!(0);
    ctx._advance(500);
    node.stop!(ctx.currentTime);
    node.start!(ctx.currentTime);
    expect(ctx._sources[1].offsets[0]).toBeCloseTo(0.5);
  });

  it('rewinds a non-looping file that played to its end', () => {
    const ctx = setup();
    const node = createFileSourceNode(ctx as never, { buffer: ctx.createBuffer(1, 100, 100) as never, loop: false });
    node.start!(0);
    ctx._advance(1500);
    expect(ctx._sources[0].ended).toBe(true);
    node.stop!(ctx.currentTime);
    node.start!(ctx.currentTime);
    expect(ctx._sources).toHaveLength(2);
    expect(ctx._sources[1].offsets[0]).toBe(0);
  });

  it('a stopped node ending late does not rewind the one after it', () => {
    const ctx = setup();
    const node = createFileSourceNode(ctx as never, { buffer: ctx.createBuffer(1, 200, 100) as never, loop: false });
    node.start!(0);
    ctx._advance(500);
    node.stop!(ctx.currentTime);
    node.start!(ctx.currentTime);
    ctx._advance(100);
    expect(ctx._sources[0].ended).toBe(true);
    node.stop!(ctx.currentTime);
    node.start!(ctx.currentTime);
    expect(ctx._sources[2].offsets[0]).toBeCloseTo(0.6);
  });

  it('retunes the playing source with rate, and the next start uses it', () => {
    const ctx = setup();
    const node = createFileSourceNode(ctx as never, { buffer: ctx.createBuffer(1, 100, 100) as never });
    node.start!(0);
    node.params.rate(1.5, 0);
    expect(ctx._sources[0].playbackRate.value).toBe(1.5);
    node.stop!(0);
    node.start!(1);
    expect(ctx._sources[1].playbackRate.value).toBe(1.5);
  });

  it('counts the resume offset from a start dated in the future', () => {
    const ctx = setup();
    const node = createFileSourceNode(ctx as never, { buffer: ctx.createBuffer(1, 300, 100) as never });
    node.start!(1);
    ctx._advance(1500);
    node.stop!(ctx.currentTime);
    node.start!(ctx.currentTime);
    expect(ctx._sources[1].offsets[0]).toBeCloseTo(0.5);
  });

  it('counts the resume offset from now for a start dated in the past', () => {
    const ctx = setup();
    const node = createFileSourceNode(ctx as never, { buffer: ctx.createBuffer(1, 300, 100) as never });
    ctx._advance(1000);
    node.start!(0);
    ctx._advance(500);
    node.stop!(ctx.currentTime);
    node.start!(ctx.currentTime);
    expect(ctx._sources[1].offsets[0]).toBeCloseTo(0.5);
  });

  it('a rate write before a future start counts only from the start', () => {
    const ctx = setup();
    const node = createFileSourceNode(ctx as never, { buffer: ctx.createBuffer(1, 400, 100) as never });
    node.start!(1);
    node.params.rate(2, 0);
    ctx._advance(1500);
    node.stop!(ctx.currentTime);
    node.start!(ctx.currentTime);
    expect(ctx._sources[1].offsets[0]).toBeCloseTo(1);
  });

  it('a rate write after a later stop retunes the node still sounding', () => {
    const ctx = setup();
    const node = createFileSourceNode(ctx as never, { buffer: ctx.createBuffer(1, 400, 100) as never });
    node.start!(0);
    ctx._advance(500);
    node.stop!(1);
    node.params.rate(2, 0);
    expect(ctx._sources[0].playbackRate.value).toBe(2);
    ctx._advance(500);
    node.start!(ctx.currentTime);
    expect(ctx._sources[1].offsets[0]).toBeCloseTo(1.5);
  });

  it('counts a ramped rate by its ramp, not as a step', () => {
    const ctx = setup();
    const node = createFileSourceNode(ctx as never, { buffer: ctx.createBuffer(1, 400, 100) as never });
    node.start!(0);
    node.params.rate(3, 1000);
    ctx._advance(1000);
    node.stop!(ctx.currentTime);
    node.start!(ctx.currentTime);
    expect(ctx._sources[1].offsets[0]).toBeCloseTo(2);
  });

  it('reports a non-looping file that plays to its end', () => {
    const ctx = setup();
    const node = createFileSourceNode(ctx as never, { buffer: ctx.createBuffer(1, 100, 100) as never, loop: false });
    const ended = vi.fn();
    node.start!(0, ended);
    ctx._advance(1500);
    expect(ended).toHaveBeenCalledTimes(1);
    node.start!(ctx.currentTime);
    expect(ctx._sources).toHaveLength(2);
    expect(ctx._sources[1].offsets[0]).toBe(0);
  });

  it('does not loop when asked not to', () => {
    const ctx = setup();
    const node = createFileSourceNode(ctx as never, { buffer: ctx.createBuffer(1, 100, 100) as never, loop: false });
    node.start!(0);
    expect(ctx._sources[0].loop).toBe(false);
  });

  it('disposes the live source and the output', () => {
    const ctx = setup();
    const node = createFileSourceNode(ctx as never, { buffer: ctx.createBuffer(1, 100, 100) as never });
    node.start!(0);
    node.dispose!();
    expect(ctx._sources[0].stopped).toHaveLength(1);
    expect((node.output as never as { disconnected: boolean }).disconnected).toBe(true);
  });
});

describe('oscillator', () => {
  it('takes its wave and frequency', () => {
    const ctx = setup();
    const node = createOscillatorNode(ctx as never, { wave: 'square', frequency: 220 });
    node.start!(0);
    const osc = ctx._oscillators[0];
    expect(osc.type).toBe('square');
    expect(osc.frequency.value).toBe(220);
    node.params.frequency(330, 10);
    expect(osc.frequency.ramps.at(-1)).toEqual({ value: 330, at: expect.closeTo(0.01, 5) });
    node.stop!(1);
    node.start!(2);
    expect(ctx._oscillators[1].frequency.value).toBeCloseTo(330);
  });

  it('a frequency write after a later stop retunes the oscillator still sounding', () => {
    const ctx = setup();
    const node = createOscillatorNode(ctx as never, {});
    node.start!(0);
    node.stop!(1);
    node.params.frequency(330, 0);
    node.params.detune(20, 0);
    expect(ctx._oscillators[0].frequency.value).toBe(330);
    expect(ctx._oscillators[0].detune.value).toBe(20);
  });

  it('defaults to a 440 Hz sine and remembers detune', () => {
    const ctx = setup();
    const node = createOscillatorNode(ctx as never, {});
    node.params.detune(50, 0);
    node.start!(0);
    expect(ctx._oscillators[0].type).toBe('sine');
    expect(ctx._oscillators[0].frequency.value).toBe(440);
    expect(ctx._oscillators[0].detune.value).toBe(50);
  });

  it('uses the shared periodic wave for a partials wave', () => {
    const ctx = setup();
    const a = createOscillatorNode(ctx as never, { wave: [1, 0.5] });
    const b = createOscillatorNode(ctx as never, { wave: [1, 0.5] });
    a.start!(0);
    b.start!(0);
    const shared = periodicWave(ctx as never, [1, 0.5]);
    expect(ctx._oscillators[0].periodicWave).toBe(shared);
    expect(ctx._oscillators[1].periodicWave).toBe(shared);
  });
});

describe('noise', () => {
  it('loops the shared buffer for its color', () => {
    const ctx = setup();
    const node = createNoiseNode(ctx as never, { color: 'pink' });
    node.start!(0);
    expect(ctx._sources[0].buffer).toBe(noiseBuffer(ctx as never, 'pink'));
    expect(ctx._sources[0].loop).toBe(true);
  });
});

describe('every source', () => {
  it('writes level to the output gain', () => {
    const ctx = setup();
    const node = createNoiseNode(ctx as never, { color: 'white' });
    node.params.level(0.25, 0);
    expect((node.output as never as { gain: { value: number } }).gain.value).toBe(0.25);
  });

  it('has no inputs, and stop before start is a no-op', () => {
    const ctx = setup();
    for (const node of [
      createNoiseNode(ctx as never, { color: 'white' }),
      createOscillatorNode(ctx as never, {}),
      createFileSourceNode(ctx as never, { buffer: ctx.createBuffer(1, 10, 10) as never }),
    ]) {
      expect(node.inputs).toEqual({});
      expect(() => node.stop!(0)).not.toThrow();
    }
  });
});
