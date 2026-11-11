import { describe, expect, it } from 'vitest';
import { spatialize } from './spatialize';

describe('spatialize, shrunk from the property tests', () => {
  it('pans along a `right` too long to measure', () => {
    const out = spatialize({ x: 0, y: 0 }, { x: 0, y: 0, z: 2 }, { right: { x: 0, y: -1e308, z: -1.7976931348623157e308 } });
    expect(out.pan).toBeCloseTo((2 * 1.7976931348623157) / Math.hypot(1, 1.7976931348623157) / 500, 9);
  });

  it('pans a source whose offset along `right` sums past the double range', () => {
    const out = spatialize({ x: -3.595386269724632e307, y: 0, z: 1.7976931348623157e308 }, { x: 0, y: 0 }, { right: { x: -5, y: 0, z: -2 } });
    expect(out.pan).toBe(-1);
  });

  it('keeps gain and pan finite for a source further than a double reaches', () => {
    const out = spatialize({ x: 1e308, y: -1e308 }, { x: -1e308, y: 1e308 }, { right: { x: 1, y: 1 }, rolloffFactor: 0 });
    expect(out).toEqual({ gain: 1, pan: 0 });
    expect(spatialize({ x: 1e308, y: 0 }, { x: -1e308, y: 0 }, { rolloff: 'linear', rolloffFactor: 0 }).gain).toBe(1);
    expect(spatialize({ x: 1e308, y: 0 }, { x: -1e308, y: 0 }).gain).toBe(0);
  });

  it('cliffs to silence past a reference distance of 0 even with no rolloff', () => {
    expect(spatialize({ x: 0, y: 1 }, { x: 0, y: 0 }, { refDistance: 0, rolloffFactor: 0 }).gain).toBe(0);
  });
});
