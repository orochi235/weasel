import { describe, it, expect } from 'vitest';
import { nativeSvgKind, nativeSvgSpace } from './index';

describe('what SVG carries natively', () => {
  it('has a paint server for solids, the two SVG gradients and patterns, and nothing else', () => {
    for (const kind of ['solid', 'linear-gradient', 'radial-gradient', 'pattern']) {
      expect(nativeSvgKind(kind)).toBe(true);
    }
    for (const kind of ['conic-gradient', 'mesh-gradient', 'noise']) {
      expect(nativeSvgKind(kind)).toBe(false);
    }
  });

  it('interpolates in sRGB only; a perceptual space is a weasel attribute other renderers ignore', () => {
    expect(nativeSvgSpace(undefined)).toBe(true);
    expect(nativeSvgSpace('rgb')).toBe(true);
    expect(nativeSvgSpace('oklab')).toBe(false);
    expect(nativeSvgSpace('oklch')).toBe(false);
  });
});
