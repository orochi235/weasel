import { describe, expect, it } from 'vitest';
import { CRAYONS, crayonHex } from './crayons';
import { toLch } from '@weasel-js/theme/engine';

describe('crayons', () => {
  it('every name resolves to a color at the hue and lightness it declares', () => {
    for (const [name, [hue, L]] of Object.entries(CRAYONS)) {
      const m = toLch(crayonHex(name));
      expect(m.L, `${name} lightness`).toBeCloseTo(L, 1);
      void hue;
      // Near-neutral colors have an unstable hue; only check where chroma is real.
      if (m.C > 0.03) {
        const d = Math.abs(((m.H - hue + 540) % 360) - 180);
        expect(d, `${name} hue`).toBeLessThan(4);
      }
    }
  });

  it('has no two names close enough to be one color', () => {
    const names = Object.keys(CRAYONS);
    for (let i = 0; i < names.length; i += 1) {
      for (let j = i + 1; j < names.length; j += 1) {
        const a = toLch(crayonHex(names[i]));
        const b = toLch(crayonHex(names[j]));
        const hueApart = Math.abs(((a.H - b.H + 540) % 360) - 180);
        const lightApart = Math.abs(a.L - b.L);
        const chromaApart = Math.abs(a.C - b.C);
        expect(
          hueApart > 6 || lightApart > 0.06 || chromaApart > 0.04,
          `${names[i]} and ${names[j]} are the same color`,
        ).toBe(true);
      }
    }
  });
});
