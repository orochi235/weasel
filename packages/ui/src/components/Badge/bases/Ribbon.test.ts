import { describe, expect, it } from 'vitest';
import Ribbon from './Ribbon';

const vertices = (path: string) => [...path.matchAll(/[ML] (-?[\d.e-]+) (-?[\d.e-]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);

describe('the ribbon base', () => {
  it('keeps two inward notches from crossing on a badge narrower than twice the taper', () => {
    const [, , rightTip, , , leftTip] = vertices(Ribbon.build({ left: 'inward', right: 'inward', taperWidth: 8 }, 12, 20).bodyPath);
    expect(leftTip![0]).toBeLessThanOrEqual(rightTip![0]!);
  });

  it('keeps two outward points from turning its top edge back on itself', () => {
    const [leftTop, rightTop] = vertices(Ribbon.build({ left: 'outward', right: 'outward', taperWidth: 8 }, 12, 20).bodyPath);
    expect(leftTop![0]).toBeLessThanOrEqual(rightTop![0]!);
  });
});
