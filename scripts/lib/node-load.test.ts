import { describe, expect, it } from 'vitest';
import { roomToOverlap, sampleLoad } from './node-load.mjs';

describe('roomToOverlap', () => {
  const limits = { idleCores: 15, gpu: 30 };

  it('overlaps on a node with the cores to spare', () => {
    expect(roomToOverlap({ cores: 18, busy: 1.7, gpu: 14 }, limits)).toEqual({ ok: true, reading: '1.7 of 18 cores busy, GPU 14%' });
  });

  it('keeps to one process on a node too small for both, idle or not', () => {
    expect(roomToOverlap({ cores: 10, busy: 0, gpu: 0 }, limits).ok).toBe(false);
  });

  it('keeps to one process when other work leaves too few cores', () => {
    expect(roomToOverlap({ cores: 18, busy: 6.5, gpu: 0 }, limits).ok).toBe(false);
  });

  it('keeps to one process when the GPU is busy', () => {
    expect(roomToOverlap({ cores: 18, busy: 0.2, gpu: 80 }, limits).ok).toBe(false);
  });

  it('decides on the cores alone where there is no GPU reading', () => {
    expect(roomToOverlap({ cores: 18, busy: 1, gpu: null }, limits)).toEqual({ ok: true, reading: '1.0 of 18 cores busy' });
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
