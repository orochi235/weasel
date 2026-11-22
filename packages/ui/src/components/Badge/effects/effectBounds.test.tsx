import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { polygonSampler } from '../bases/polygonSampler';
import type { EffectModule, PerimeterPoint } from '../bases/types';
import Aqua from './Aqua';
import Bites from './Bites';
import Metal from './Metal';
import Perforations from './Perforations';
import Puffs from './Puffs';
import Rivets from './Rivets';
import Scallops from './Scallops';
import Spikes from './Spikes';
import Sunbeams from './Sunbeams';
import { rangeMask } from './rangeMask';

const line = (s: number): PerimeterPoint => ({ x: s, y: 0, nx: 0, ny: -1 });

const square: [number, number][] = [[0, 0], [100, 0], [100, 100], [0, 100]];

function draw(effect: EffectModule<object>, params: object, boxW = 200, boxH = 30): HTMLElement {
  const Component = effect.Component!;
  const { container } = render(
    <svg>
      <Component sampler={polygonSampler(square, boxW, boxH)} boxW={boxW} boxH={boxH} variant="solid" params={params} phase={0} />
    </svg>,
  );
  return container;
}

function outline(effect: EffectModule<object>, params: object, totalCss = 200): number[] {
  const out: number[] = [];
  for (let s = 0; s < totalCss; s += 0.5) out.push(effect.offsetAt!(s, { params, phase: 0, totalCss, perimeterAt: line }).dy);
  return out;
}

describe('an infinite bump effect param', () => {
  const cases: [string, EffectModule<object>, object][] = [
    ['puffs', Puffs, { irregularity: Infinity }],
    ['bites', Bites, { irregularity: Infinity }],
    ['scallops', Scallops, { irregularity: Infinity }],
    ['spikes', Spikes, { irregularity: Infinity, cornerCompensation: -Infinity }],
  ];
  for (const [name, effect, params] of cases) {
    it(`${name} reads ${Object.keys(params).join(' and ')} as the default`, () => {
      expect(outline(effect, params)).toEqual(outline(effect, {}));
    });
  }
});

describe('a range with an entry that is not a finite number', () => {
  it('reads as no range, keeping the effect on the whole perimeter', () => {
    for (const range of [[NaN, 0.5], [0.2, Infinity], [-Infinity, NaN]] as [number, number][]) {
      for (const s of [0, 30, 99]) expect(rangeMask(s, 100, range)).toBe(1);
    }
    expect(outline(Spikes, { range: [NaN, 0.5] })).toEqual(outline(Spikes, {}));
  });
});

describe('an infinite perforations param', () => {
  it('holds holeRadius to the box\'s longer side, so the holes mask the whole badge', () => {
    const holes = [...draw(Perforations, { holeRadius: Infinity }).querySelectorAll('ellipse')];
    expect(holes.length).toBeGreaterThan(0);
    for (const h of holes) {
      expect(Number(h.getAttribute('rx'))).toBe(100);
      expect(Number(h.getAttribute('ry'))).toBeCloseTo((100 * 200) / 30);
    }
  });

  it('reads holeSpacing as the default', () => {
    expect(draw(Perforations, { holeSpacing: Infinity }).innerHTML).toBe(draw(Perforations, {}).innerHTML);
  });
});

describe('a negative rivets radius', () => {
  it('reads as 0, drawing no rivet rather than an invalid one', () => {
    const drawn = draw(Rivets, { radius: -2 });
    expect(drawn.querySelectorAll('ellipse')).toHaveLength(0);
    expect(draw(Rivets, { radius: 0 }).querySelectorAll('ellipse')).toHaveLength(0);
  });
});

describe('a glassy effect color-mix percentage', () => {
  const cases: [string, EffectModule<object>, string][] = [
    ['aqua', Aqua, 'equatorTint'],
    ['aqua', Aqua, 'baseTint'],
    ['metal', Metal, 'topDarkness'],
    ['metal', Metal, 'baseDarkness'],
  ];
  for (const [name, effect, param] of cases) {
    it(`${name} throws a RangeError naming ${param} outside 0..100`, () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      for (const v of [-10, 120]) expect(() => draw(effect, { [param]: v })).toThrow(new RegExp(`${name}.*${param}`));
      vi.restoreAllMocks();
      for (const v of [0, 100]) expect(draw(effect, { [param]: v }).innerHTML).toContain(`${v}%`);
    });
  }
});

describe('a sunbeams angle near 90°', () => {
  const beams = (params: object) => [...draw(Sunbeams, { count: 40, width: 2, gap: 1, ...params }).querySelectorAll('polygon')]
    .map((p) => p.getAttribute('points')!.split(' ').map((xy) => xy.split(',').map(Number)));

  it('keeps every jittered beam leaning the way `angle` does', () => {
    for (const pts of beams({ angle: 85, irregularity: 1 })) expect(pts[0][0]).toBeGreaterThan(pts[3][0]);
    for (const pts of beams({ angle: -85, irregularity: 1 })) expect(pts[0][0]).toBeLessThan(pts[3][0]);
  });

  it('holds a beam short of horizontal, drawing it at 89°', () => {
    expect(beams({ angle: 90 })).toEqual(beams({ angle: 89 }));
    expect(beams({ angle: 135 })).toEqual(beams({ angle: 89 }));
  });
});
