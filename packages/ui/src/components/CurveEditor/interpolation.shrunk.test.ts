import { describe, expect, it } from 'vitest';
import { sampleByInterpolation } from './interpolation';

const finite = (ps: { x: number; y: number }[]) => ps.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

describe('sampleByInterpolation, shrunk counterexamples', () => {
  it('samples past a repeated anchor without NaN', () => {
    const out = sampleByInterpolation([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }], 2, 'catmull-rom');
    expect(finite(out)).toBe(true);
    expect(out[3]!.x).toBe(out[3]!.y);
  });

  it('samples anchors near the double range without overflowing', () => {
    const out = sampleByInterpolation([{ x: 0, y: 1e308 }, { x: 0, y: 0 }, { x: 0, y: 0 }], 2, 'catmull-rom-uniform');
    expect(out).toHaveLength(5);
    expect(finite(out)).toBe(true);
  });

  it('lays one sample per segment for a NaN count', () => {
    expect(sampleByInterpolation([{ x: 0, y: 0 }, { x: 1, y: 0 }], Number.NaN, 'linear')).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    expect(sampleByInterpolation([{ x: 0, y: 0 }, { x: 1, y: 0 }], 2.5, 'linear')).toHaveLength(3);
  });
});
