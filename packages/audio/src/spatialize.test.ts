import { describe, expect, it } from 'vitest';
import { spatialize } from './spatialize';

const L = { x: 0, y: 0 };

describe('spatialize', () => {
  it('is full gain and centered at the listener', () => {
    expect(spatialize({ x: 0, y: 0 }, L)).toEqual({ gain: 1, pan: 0 });
  });

  it('holds full gain inside refDistance', () => {
    expect(spatialize({ x: 0, y: 5 }, L, { refDistance: 10 }).gain).toBe(1);
  });

  it('falls off with distance past refDistance', () => {
    const near = spatialize({ x: 0, y: 20 }, L, { refDistance: 10 }).gain;
    const far = spatialize({ x: 0, y: 40 }, L, { refDistance: 10 }).gain;
    expect(near).toBeLessThan(1);
    expect(far).toBeLessThan(near);
    expect(far).toBeGreaterThan(0);
  });

  it('pans right for a source to the right', () => {
    expect(spatialize({ x: 50, y: 0 }, L, { panWidth: 100 }).pan).toBeCloseTo(0.5, 6);
  });

  it('pans left for a source to the left', () => {
    expect(spatialize({ x: -50, y: 0 }, L, { panWidth: 100 }).pan).toBeCloseTo(-0.5, 6);
  });

  it('clamps pan to the -1..1 range', () => {
    expect(spatialize({ x: 9999, y: 0 }, L, { panWidth: 100 }).pan).toBe(1);
    expect(spatialize({ x: -9999, y: 0 }, L, { panWidth: 100 }).pan).toBe(-1);
  });

  it('pans relative to the listener, not the origin', () => {
    expect(spatialize({ x: 100, y: 0 }, { x: 150, y: 0 }, { panWidth: 100 }).pan)
      .toBeCloseTo(-0.5, 6);
  });

  it('reaches exactly zero gain at maxDistance under linear rolloff', () => {
    const out = spatialize({ x: 0, y: 100 }, L, {
      rolloff: 'linear', refDistance: 0, maxDistance: 100,
    });
    expect(out.gain).toBe(0);
  });

  it('never returns negative gain past maxDistance', () => {
    const out = spatialize({ x: 0, y: 500 }, L, {
      rolloff: 'linear', refDistance: 0, maxDistance: 100,
    });
    expect(out.gain).toBe(0);
  });

  it('ignores vertical offset for pan', () => {
    expect(spatialize({ x: 0, y: 500 }, L, { panWidth: 100 }).pan).toBe(0);
  });
});
