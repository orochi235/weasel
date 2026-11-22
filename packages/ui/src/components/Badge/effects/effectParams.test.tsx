import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { polygonSampler } from '../bases/polygonSampler';
import type { EffectModule } from '../bases/types';
import Aqua from './Aqua';
import Bevel from './Bevel';
import Bevel2 from './Bevel2';
import Metal from './Metal';
import Outline from './Outline';
import Rivets from './Rivets';
import Shadow from './Shadow';
import Sheen from './Sheen';
import Sunbeams from './Sunbeams';
import Woodgrain from './Woodgrain';

const square: [number, number][] = [[0, 0], [100, 0], [100, 100], [0, 100]];

function markup<P>(effect: EffectModule<P>, params: P): string {
  const Component = effect.Component!;
  const { container } = render(
    <svg>
      <Component sampler={polygonSampler(square, 200, 30)} boxW={200} boxH={30} variant="solid" params={params} phase={0} />
    </svg>,
  );
  return container.innerHTML;
}

describe('a drawn effect param that is not a finite number', () => {
  const cases: [string, EffectModule<object>, object][] = [
    ['sunbeams', Sunbeams, { irregularity: NaN, opacity: NaN, width: Infinity, gap: NaN, angle: NaN, offset: NaN, gradientAngle: NaN, gradientStart: NaN, gradientEnd: NaN }],
    ['metal', Metal, { specularity: NaN, equator: NaN, equatorSpread: Infinity, topDarkness: NaN, glossExtent: NaN, bezelWidth: NaN }],
    ['aqua', Aqua, { topAlpha: NaN, equator: NaN, equatorSpread: NaN, equatorTint: NaN, glossExtent: Infinity, rimWidth: NaN }],
    ['shadow', Shadow, { dx: NaN, dy: Infinity, opacity: NaN }],
    ['sheen', Sheen, { intensity: NaN }],
    ['woodgrain', Woodgrain, { intensity: NaN }],
    ['bevel', Bevel, { bevelWidth: NaN }],
    ['bevel2', Bevel2, { bevelWidth: Infinity }],
    ['rivets', Rivets, { radius: NaN, inset: NaN }],
    ['outline', Outline, { width: NaN, opacity: NaN }],
  ];
  for (const [name, effect, params] of cases) {
    it(`${name} draws it as the param's default`, () => {
      const keys = Object.keys(params) as (keyof typeof effect.defaults)[];
      const defaults = Object.fromEntries(keys.map((k) => [k, (effect.defaults as Record<string, unknown>)[k as string]]));
      const drawn = markup(effect, params);
      expect(drawn).not.toMatch(/NaN|Infinity/);
      expect(drawn.replace(/_r_[\w]+_|«r\w+»|:r\w+:/g, '')).toBe(markup(effect, defaults).replace(/_r_[\w]+_|«r\w+»|:r\w+:/g, ''));
    });
  }
});

describe('a bevel2 lightFrom', () => {
  it('throws a RangeError naming the effect for one that is not a finite number', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const lightFrom of [NaN, Infinity, 'tl']) {
      expect(() => markup(Bevel2 as EffectModule<object>, { lightFrom })).toThrow(/bevel2/);
    }
    vi.restoreAllMocks();
  });

  it('gives every band a shade', () => {
    const c = document.createElement('div');
    c.innerHTML = markup(Bevel2, { lightFrom: 45 });
    for (const band of c.querySelectorAll('g path')) expect(band.getAttribute('class')).toMatch(/^badge-bevel-/);
  });
});
