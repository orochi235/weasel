import { describe, expect, it } from 'vitest';
import { createAnalyserTap } from './analyser';
import { createFakeAudioContext } from './testing/fakeAudioContext';

describe('createAnalyserTap', () => {
  it('connects the analyser to the tapped node', () => {
    const ctx = createFakeAudioContext();
    const source = ctx.createGain();
    createAnalyserTap(ctx as never, source as never);
    expect(source.connectedTo.some((n) => n.kind === 'analyser')).toBe(true);
  });

  it('returns frequency data sized to the bin count', () => {
    const ctx = createFakeAudioContext();
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    expect(tap.frequencies()).toHaveLength(1024);
  });

  it('returns a whole time-domain window, not half of it', () => {
    const ctx = createFakeAudioContext();
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    // Time-domain data is sized by fftSize; frequencyBinCount is half that.
    expect(tap.waveform()).toHaveLength(2048);
  });

  it('reads the whole window for level, not half of it', () => {
    const ctx = createFakeAudioContext();
    // Silent first half, full deflection second half.
    ctx._analyserBytes = (i) => (i < 1024 ? 128 : 255);
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    expect(tap.level()).toBeCloseTo(Math.sqrt(0.5 * (127 / 128) ** 2), 3);
  });

  it('resizes its scratch when fftSize changes under it', () => {
    const ctx = createFakeAudioContext();
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never, { fftSize: 512 });
    expect(tap.waveform()).toHaveLength(512);
    expect(tap.frequencies()).toHaveLength(256);
    tap.node.fftSize = 64;
    expect(tap.waveform()).toHaveLength(64);
    expect(tap.bands(4)).toHaveLength(4);
  });

  it('averages the bins each band covers', () => {
    const ctx = createFakeAudioContext();
    ctx._analyserBytes = (i, length) => (i < length / 2 ? 0 : 255);
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    const bands = tap.bands(2);
    expect(bands[0]).toBeCloseTo(0, 6);
    expect(bands[1]).toBeCloseTo(1, 6);
  });

  it('reuses a caller-supplied array instead of allocating', () => {
    const ctx = createFakeAudioContext();
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    const out = new Uint8Array(1024);
    expect(tap.frequencies(out)).toBe(out);
  });

  it('collapses bins into n bands', () => {
    const ctx = createFakeAudioContext();
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    expect(tap.bands(8)).toHaveLength(8);
  });

  it('normalizes bands to 0..1', () => {
    const ctx = createFakeAudioContext();
    ctx._analyserBytes = 255;
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    const bands = tap.bands(4);
    for (const b of bands) expect(b).toBeCloseTo(1, 6);
  });

  it('reports silence as zero level', () => {
    const ctx = createFakeAudioContext();
    ctx._analyserBytes = 128;   // 128 is the zero point for time-domain bytes
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    expect(tap.level()).toBeCloseTo(0, 3);
  });

  it('detaches from the tapped source on dispose', () => {
    const ctx = createFakeAudioContext();
    const source = ctx.createGain();
    const tap = createAnalyserTap(ctx as never, source as never);
    tap.dispose();
    expect(source.connectedTo).not.toContain(tap.node as never);
  });

  it('leaves other taps on the same source alone, and survives a second dispose', () => {
    const ctx = createFakeAudioContext();
    const source = ctx.createGain();
    const a = createAnalyserTap(ctx as never, source as never);
    const b = createAnalyserTap(ctx as never, source as never);
    a.dispose();
    a.dispose();
    expect(source.connectedTo).toContain(b.node as never);
  });

  it('writes bands into a caller-supplied array instead of allocating', () => {
    const ctx = createFakeAudioContext();
    ctx._analyserBytes = 255;
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    const out = new Float32Array(4);
    expect(tap.bands(4, out)).toBe(out);
    for (const b of out) expect(b).toBeCloseTo(1, 6);
    // The no-arg form still allocates.
    expect(tap.bands(4)).not.toBe(out);
  });

  it('throws when the supplied bands array is not n long', () => {
    const ctx = createFakeAudioContext();
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    expect(() => tap.bands(4, new Float32Array(3))).toThrow(/length 4, got 3/);
    expect(() => tap.bands(4, new Float32Array(5))).toThrow(/@weasel-js\/audio/);
  });

  it('returns bands narrowed to Float32Array<ArrayBuffer>', () => {
    const ctx = createFakeAudioContext();
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    const narrowed: Float32Array<ArrayBuffer> = tap.bands(4);
    expect(narrowed).toHaveLength(4);
  });

  it('throws for a band count below 1', () => {
    const ctx = createFakeAudioContext();
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    expect(() => tap.bands(0)).toThrow(/bands/);
  });
});
