import { describe, expect, it } from 'vitest';
import { BASES } from '.';
import { resolveCompose } from '../composeSpec';
import { SHAPES } from '../shapes';

const finite = (path: string) => !/NaN|Infinity|undefined/.test(path);

describe('a base param set to undefined', () => {
  const cases: [keyof typeof BASES, Record<string, unknown>][] = [
    ['chamfered-rect', { chamfer: undefined }],
    ['rounded-rect', { erosion: undefined, eccentricity: undefined, pinch: undefined }],
    ['powerline', { depth: undefined }],
    ['ribbon', { left: undefined, right: undefined, taperWidth: undefined }],
    ['quatrefoil', { spikeR: undefined, samples: undefined }],
    ['octant-spline', { count: undefined, s1: undefined, r1: undefined, samples: undefined }],
    ['octant-bspline', { count: undefined, r2: undefined }],
  ];
  for (const [key, params] of cases) {
    it(`reads as the ${key} base's default`, () => {
      const base = BASES[key];
      expect(base.build(params as never, 80, 20).bodyPath).toBe(base.build({} as never, 80, 20).bodyPath);
    });
  }

  it('reads as the default puzzle edge rather than a socket', () => {
    expect(BASES.puzzle.build({ top: undefined }, 80, 20).bodyPath).toBe(BASES.puzzle.build({}, 80, 20).bodyPath);
  });

  it('pads a powerline badge as it draws it', () => {
    const insets = BASES.powerline.insets as (p: object) => object;
    expect(insets({ depth: undefined })).toEqual(insets({}));
  });

  it('keeps the default through resolveCompose', () => {
    const spec = resolveCompose(SHAPES.pill, undefined, { base: 'chamfered-rect', baseParams: { chamfer: undefined } });
    expect(spec.baseParams).toEqual({ chamfer: 6 });
    expect(finite(spec.base!.build(spec.baseParams, 80, 20).bodyPath)).toBe(true);
  });
});

describe('an end or edge no base names', () => {
  it('throws on a ribbon', () => {
    expect(() => BASES.ribbon.build({ left: 'diagonal' as never }, 80, 20)).toThrow(RangeError);
    expect(() => (BASES.ribbon.insets as (p: object) => object)({ right: 'diagonal' })).toThrow(RangeError);
  });

  it('throws on a puzzle', () => {
    expect(() => BASES.puzzle.build({ top: 'sideways' as never }, 80, 20)).toThrow(RangeError);
  });
});
