import { describe, expect, it } from 'vitest';
import { logDepthAt, logDepthUniform } from './logDepth';

const D = { knee: Math.sqrt(0.1 * 2e6), far: 2e6 };
/** The 24-bit depth buffer's step. */
const STEP = 1 / (2 ** 24 - 1);

describe('logDepthAt', () => {
  it('runs from 0 at the eye to 1 at the far plane', () => {
    expect(logDepthAt(0, D)).toBeCloseTo(0, 12);
    expect(logDepthAt(D.far, D)).toBeCloseTo(1, 12);
  });

  it('rises with distance', () => {
    let last = -1;
    for (const w of [0.1, 1, 10, 1e3, 1e5, 1e6, 1.9e6]) {
      expect(logDepthAt(w, D)).toBeGreaterThan(last);
      last = logDepthAt(w, D);
    }
  });

  it('keeps two surfaces 1 m apart at 1e6 m more than one 24-bit step apart, where standard depth does not', () => {
    const apart = logDepthAt(1e6 + 1, D) - logDepthAt(1e6, D);
    expect(apart / STEP).toBeGreaterThan(1.5);
    const n = 0.1, f = D.far;
    const standard = (w: number) => (f / (f - n)) * (1 - n / w);
    expect((standard(1e6 + 1) - standard(1e6)) / STEP).toBeLessThan(1e-3);
  });
});

describe('logDepthUniform', () => {
  it('gives the shader what reproduces logDepthAt', () => {
    const [k, farK, inv] = logDepthUniform(D);
    for (const w of [1, 500, 1e6]) expect(1 + Math.log2((w + k) / farK) * inv).toBeCloseTo(logDepthAt(w, D), 12);
  });
});
