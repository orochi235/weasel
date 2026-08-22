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

  it('returns waveform data', () => {
    const ctx = createFakeAudioContext();
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    expect(tap.waveform()).toHaveLength(1024);
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

  it('disconnects on dispose', () => {
    const ctx = createFakeAudioContext();
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    tap.dispose();
    expect((tap.node as never as { disconnected: boolean }).disconnected).toBe(true);
  });

  it('throws for a band count below 1', () => {
    const ctx = createFakeAudioContext();
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    expect(() => tap.bands(0)).toThrow(/bands/);
  });
});
