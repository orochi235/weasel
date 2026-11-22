import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { polygonSampler } from '../bases/polygonSampler';
import type { EffectModule, PerimeterPoint } from '../bases/types';
import Bites from './Bites';
import Perforations from './Perforations';
import Puffs from './Puffs';
import Rivets from './Rivets';
import Scallops from './Scallops';
import Spikes from './Spikes';
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
