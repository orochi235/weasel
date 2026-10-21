import { describe, expect, it } from 'vitest';
import { roomToOverlap, sampleLoad } from './node-load.mjs';

describe('roomToOverlap', () => {
  const limits = { reserve: 3, minJsdomWorkers: 4, gpu: 30 };

  it('overlaps on a 10-core node, giving jsdom the idle cores less the browser reserve', () => {
    expect(roomToOverlap({ cores: 10, busy: 0.6, gpu: 0 }, limits)).toEqual({
      ok: true,
      jsdomWorkers: 6,
      reading: '0.6 of 10 cores busy, GPU 0%',
    });
  });

  it('sizes jsdom from idle cores, not the node: other work takes from jsdom, never from the reserve', () => {
    expect(roomToOverlap({ cores: 18, busy: 6.5, gpu: 0 }, limits)).toMatchObject({ ok: true, jsdomWorkers: 8 });
  });

  it('keeps to one process when the reserve would leave jsdom too few workers', () => {
    expect(roomToOverlap({ cores: 8, busy: 2, gpu: 0 }, limits).ok).toBe(false);
  });

  it('keeps to one process when the GPU is busy', () => {
    expect(roomToOverlap({ cores: 18, busy: 0.2, gpu: 80 }, limits).ok).toBe(false);
  });

  it('decides on the cores alone where there is no GPU reading', () => {
    expect(roomToOverlap({ cores: 18, busy: 1, gpu: null }, limits)).toEqual({ ok: true, jsdomWorkers: 14, reading: '1.0 of 18 cores busy' });
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
