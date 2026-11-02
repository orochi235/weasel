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

  it('follows the inverse-distance curve past refDistance', () => {
    expect(spatialize({ x: 0, y: 30 }, L, { refDistance: 10 }).gain)
      .toBeCloseTo(10 / (10 + 20), 12);
  });

  it('measures the inverse curve from a refDistance of 1 by default', () => {
    expect(spatialize({ x: 0, y: 3 }, L).gain).toBeCloseTo(1 / (1 + 2), 12);
  });

  it('falls off faster under a larger rolloffFactor', () => {
    const slow = spatialize({ x: 0, y: 30 }, L, { refDistance: 10, rolloffFactor: 1 }).gain;
    const fast = spatialize({ x: 0, y: 30 }, L, { refDistance: 10, rolloffFactor: 2 }).gain;
    expect(slow).toBeCloseTo(10 / (10 + 20), 12);
    expect(fast).toBeCloseTo(10 / (10 + 2 * 20), 12);
    expect(fast).toBeLessThan(slow);
  });

  it('scales linear rolloff by rolloffFactor too', () => {
    const opts = { rolloff: 'linear' as const, refDistance: 10, maxDistance: 110 };
    expect(spatialize({ x: 0, y: 35 }, L, opts).gain).toBeCloseTo(1 - 25 / 100, 12);
    expect(spatialize({ x: 0, y: 35 }, L, { ...opts, rolloffFactor: 2 }).gain)
      .toBeCloseTo(1 - 2 * (25 / 100), 12);
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

  it('cliffs from full gain to silence when the inverse model gets refDistance 0', () => {
    expect(spatialize({ x: 0, y: 0 }, L, { refDistance: 0 }).gain).toBe(1);
    expect(spatialize({ x: 0, y: 0.001 }, L, { refDistance: 0 }).gain).toBe(0);
  });

  it('cliffs the same way when linear rolloff gets maxDistance at refDistance', () => {
    const opts = { rolloff: 'linear' as const, refDistance: 10, maxDistance: 10 };
    expect(spatialize({ x: 0, y: 10 }, L, opts).gain).toBe(1);
    expect(spatialize({ x: 0, y: 10.001 }, L, opts).gain).toBe(0);
  });

  it('ignores vertical offset for pan', () => {
    expect(spatialize({ x: 0, y: 500 }, L, { panWidth: 100 }).pan).toBe(0);
  });
});

describe('spatialize in 3D', () => {
  it('reads an absent z as 0, matching the 2D result exactly', () => {
    for (const [x, y] of [[3, 4], [123.456, -987.654], [-0.1, 0.7]]) {
      const opts = { refDistance: 10, panWidth: 100 };
      expect(spatialize({ x, y, z: 0 }, { x: 0, y: 0, z: 0 }, opts))
        .toEqual(spatialize({ x, y }, L, opts));
      expect(spatialize({ x, y }, L, { ...opts, right: { x: 1, y: 0, z: 0 } }))
        .toEqual(spatialize({ x, y }, L, opts));
    }
  });

  it('falls off with the full 3D distance', () => {
    expect(spatialize({ x: 0, y: 0, z: 30 }, L, { refDistance: 10 }).gain)
      .toBeCloseTo(10 / (10 + 20), 12);
    expect(spatialize({ x: 10, y: 20, z: 20 }, { x: 0, y: 0, z: 0 }, { refDistance: 10 }).gain)
      .toBeCloseTo(10 / (10 + 20), 12);
  });

  it('centers a source directly above the listener', () => {
    expect(spatialize({ x: 0, y: 0, z: 50 }, L, { panWidth: 100 }).pan).toBe(0);
  });

  it('pans fully right for a source along the right vector', () => {
    const right = { x: 0, y: 0, z: 1 };
    expect(spatialize({ x: 0, y: 0, z: 100 }, L, { panWidth: 100, right }).pan).toBe(1);
    expect(spatialize({ x: 0, y: 0, z: -100 }, L, { panWidth: 100, right }).pan).toBe(-1);
  });

  it('ignores the right vector length', () => {
    const src = { x: 30, y: 0, z: 40 };
    expect(spatialize(src, L, { panWidth: 100, right: { x: 0, y: 0, z: 5 } }).pan)
      .toBeCloseTo(0.4, 12);
  });

  it('swaps the result when the right vector turns 90 degrees', () => {
    const opts = { panWidth: 100 };
    const xAxis = { x: 1, y: 0, z: 0 };
    const zAxis = { x: 0, y: 0, z: 1 };
    const side = { x: 50, y: 0, z: 0 };
    const above = { x: 0, y: 0, z: 50 };
    expect(spatialize(side, L, { ...opts, right: xAxis }).pan).toBeCloseTo(0.5, 12);
    expect(spatialize(side, L, { ...opts, right: zAxis }).pan).toBe(0);
    expect(spatialize(above, L, { ...opts, right: xAxis }).pan).toBe(0);
    expect(spatialize(above, L, { ...opts, right: zAxis }).pan).toBeCloseTo(0.5, 12);
  });

  it('centers everything under a zero-length right vector', () => {
    expect(spatialize({ x: 50, y: 0 }, L, { right: { x: 0, y: 0, z: 0 } }).pan).toBe(0);
  });
});
