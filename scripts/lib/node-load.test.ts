import { describe, expect, it } from 'vitest';
import { roomToOverlap, sampleLoad } from './node-load.mjs';

describe('roomToOverlap', () => {
  const limits = { busyShare: 0.1, gpu: 30 };

  it('overlaps on an idle node', () => {
    expect(roomToOverlap({ cores: 18, busy: 0.6, gpu: 14 }, limits)).toEqual({ ok: true, reading: '0.6 of 18 cores busy, GPU 14%' });
  });

  it('keeps to one process when the cores are busy', () => {
    expect(roomToOverlap({ cores: 18, busy: 2.4, gpu: 0 }, limits).ok).toBe(false);
  });

  it('keeps to one process when the GPU is busy', () => {
    expect(roomToOverlap({ cores: 18, busy: 0.2, gpu: 80 }, limits).ok).toBe(false);
  });

  it('decides on the cores alone where there is no GPU reading', () => {
    expect(roomToOverlap({ cores: 8, busy: 0.4, gpu: null }, limits)).toEqual({ ok: true, reading: '0.4 of 8 cores busy' });
  });
});

describe('sampleLoad', () => {
  it('reads every core and a busy count within them', async () => {
    const load = await sampleLoad(100);
    expect(load.cores).toBeGreaterThan(0);
    expect(load.busy).toBeGreaterThanOrEqual(0);
    expect(load.busy).toBeLessThanOrEqual(load.cores);
  });
});
