import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { polygonSampler } from '../bases/polygonSampler';
import type { EffectModule, PerimeterPoint } from '../bases/types';
import Aqua from './Aqua';
import Bevel from './Bevel';
import Bevel2 from './Bevel2';
import { bevelBands } from './bevelBands';
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

describe('bevel bands', () => {
  const outerOf = (d: string) => {
    const pts = d.match(/-?[\d.]+ -?[\d.]+/g)!;
    return pts.slice(0, pts.length / 2);
  };

  for (const [name, effect] of [['bevel', Bevel], ['bevel2', Bevel2]] as const) {
    it(`${name} meets each neighbor at one sample, painting no seam twice`, () => {
      const ds = [...draw(effect as EffectModule<object>, { lightFrom: name === 'bevel' ? 'tl' : 10 }).querySelectorAll('g path')]
        .map((p) => p.getAttribute('d')!);
      expect(ds.length).toBeGreaterThan(1);
      for (let i = 0; i < ds.length; i++) {
        const a = outerOf(ds[i]);
        const b = outerOf(ds[(i + 1) % ds.length]);
        expect(a.filter((pt) => b.includes(pt))).toEqual([a[a.length - 1]]);
        expect(b[0]).toBe(a[a.length - 1]);
      }
    });
  }

  it('bevel2 draws one band for neighboring buckets of the same shade', () => {
    const circle = Array.from({ length: 64 }, (_, i): [number, number] => [50 + 50 * Math.cos((i / 64) * 2 * Math.PI), 50 + 50 * Math.sin((i / 64) * 2 * Math.PI)]);
    const C = Bevel2.Component!;
    const { container } = render(
      <svg>
        <C sampler={polygonSampler(circle, 100, 100)} boxW={100} boxH={100} variant="solid" params={{ lightFrom: 10 }} phase={0} />
      </svg>,
    );
    const classes = [...container.querySelectorAll('g path')].map((p) => p.getAttribute('class'));
    expect(classes.length).toBeGreaterThan(1);
    for (let i = 0; i < classes.length; i++) expect(classes[i]).not.toBe(classes[(i + 1) % classes.length]);
  });

  it('closes a single band round the whole outline', () => {
    const [band] = bevelBands(polygonSampler(square, 200, 30), 200, 30, 6, () => 'all');
    const outer = outerOf(band.d);
    expect(outer[outer.length - 1]).toBe(outer[0]);
  });
});
