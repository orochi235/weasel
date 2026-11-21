import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { polygonSampler } from '../bases/polygonSampler';
import type { BaseSampler, EffectModule, PerimeterPoint } from '../bases/types';
import Aqua from './Aqua';
import Bevel from './Bevel';
import Bevel2 from './Bevel2';
import Bites from './Bites';
import Metal from './Metal';
import Outline from './Outline';
import Perforations from './Perforations';
import Scallops from './Scallops';
import Sheen from './Sheen';
import Spikes from './Spikes';
import Sunbeams from './Sunbeams';

const square: [number, number][] = [[0, 0], [100, 0], [100, 100], [0, 100]];

function draw<P>(effect: EffectModule<P>, params: P, boxW = 200, boxH = 30, sampler?: BaseSampler) {
  const Component = effect.Component!;
  const s = sampler ?? polygonSampler(square, boxW, boxH);
  const { container } = render(
    <svg>
      <Component sampler={s} boxW={boxW} boxH={boxH} variant="solid" params={params} phase={0} />
    </svg>,
  );
  return container;
}

describe('a Badge effect stroke', () => {
  it('draws an outline `width` as that many CSS px on a stretched badge', () => {
    const path = draw(Outline, { width: 2 }).querySelector('path')!;
    expect(path.getAttribute('stroke-width')).toBe('2');
  });

  it('draws the aqua and metal bezel and rim at their CSS px widths', () => {
    for (const effect of [Aqua, Metal] as EffectModule<{ bezelWidth: number; rimWidth: number }>[]) {
      const widths = [...draw(effect, { bezelWidth: 1.5, rimWidth: 2 }).querySelectorAll('path[stroke]')]
        .map((p) => p.getAttribute('stroke-width'));
      expect(new Set(widths)).toEqual(new Set(['1.5', '2']));
    }
  });
});

describe('a glassy effect gloss', () => {
  it('fades out `glossExtent` units down', () => {
    for (const effect of [Aqua, Metal] as EffectModule<{ glossExtent: number; specularity?: number }>[]) {
      const c = draw(effect, { glossExtent: 40, specularity: 1 });
      const rect = c.querySelector('rect[clip-path]')!;
      expect(rect.getAttribute('height')).toBe('40');
      const id = rect.getAttribute('fill')!.match(/url\(#(.+)\)/)![1];
      const grad = [...c.querySelectorAll('linearGradient')].find((g) => g.id === id)!;
      expect(grad.getAttribute('y1')).toBe('0');
      expect(grad.getAttribute('y2')).toBe('40');
    }
  });
});

describe('perforations', () => {
  it('draws a bounded row of holes when the radius and the spacing are both 0', () => {
    const holes = draw(Perforations, { holeRadius: 0, holeSpacing: 0 }).querySelectorAll('ellipse');
    expect(holes.length).toBeGreaterThan(0);
    expect(holes.length).toBeLessThanOrEqual(Math.ceil(polygonSampler(square, 200, 30).totalCss));
  });

  it('draws no hole with a negative radius', () => {
    const hole = draw(Perforations, { holeRadius: -2 }).querySelector('ellipse')!;
    expect(Number(hole.getAttribute('rx'))).toBe(0);
  });
});

describe('a bevel', () => {
  for (const [name, effect] of [['bevel', Bevel], ['bevel2', Bevel2]] as const) {
    it(`${name} leaves no gap between neighboring bands`, () => {
      const paths = [...draw(effect as EffectModule<object>, {}).querySelectorAll('g path')];
      expect(paths.length).toBeGreaterThan(1);
      const outerOf = (p: Element) => {
        const pts = p.getAttribute('d')!.match(/-?[\d.]+ -?[\d.]+/g)!;
        return new Set(pts.slice(0, pts.length / 2));
      };
      for (let i = 0; i < paths.length; i++) {
        const a = outerOf(paths[i]);
        const b = outerOf(paths[(i + 1) % paths.length]);
        expect([...a].some((pt) => b.has(pt))).toBe(true);
      }
    });
  }
});

const line = (s: number): PerimeterPoint => ({ x: s, y: 0, nx: 0, ny: -1 });

describe('an irregular bump', () => {
  for (const [name, effect, params] of [
    ['bites', Bites, { biteRadius: 4, biteSpacing: 8.5, irregularity: 1 }],
    ['scallops', Scallops, { scallopRadius: 4, scallopSpacing: 8.5, irregularity: 1 }],
  ] as const) {
    it(`${name} meets its neighbor at the outline between them`, () => {
      const totalCss = 200;
      const at = (s: number) => (effect as EffectModule<object>).offsetAt!(s, { params, phase: 0, totalCss, perimeterAt: line }).dy;
      let worst = 0;
      for (let s = 0; s < totalCss; s += 0.01) worst = Math.max(worst, Math.abs(at(s + 0.01) - at(s)));
      expect(worst).toBeLessThan(0.1);
    });
  }
});

describe('spikes', () => {
  it('holds irregularity to 0..1, so every spike points outward', () => {
    const totalCss = 400;
    for (let s = 0; s < totalCss; s += 0.5) {
      const { dy } = Spikes.offsetAt!(s, { params: { irregularity: 5 }, phase: 0, totalCss, perimeterAt: line });
      expect(Number.isFinite(dy)).toBe(true);
      expect(dy).toBeLessThanOrEqual(0);
    }
    const tipAt = (irregularity: number) =>
      Spikes.offsetAt!(totalCss / 44, { params: { irregularity }, phase: 0, totalCss, perimeterAt: line }).dy;
    expect(tipAt(5)).toBe(tipAt(1));
  });
});

describe('sunbeams', () => {
  const fadeAt = (grad: Element, x: number, y: number) => {
    const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((k) => Number(grad.getAttribute(k)));
    return ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2);
  };

  it('reaches the badge corners at 0 and 1 along a diagonal gradient', () => {
    const grad = draw(Sunbeams, { gradientAngle: 45 }).querySelector('linearGradient')!;
    expect(fadeAt(grad, 0, 0)).toBeCloseTo(0);
    expect(fadeAt(grad, 100, 100)).toBeCloseTo(1);
  });

  it('lays `gradientAngle` on screen, as the beams lean by `angle`', () => {
    // On a 200×30 badge, 10 CSS px right and 10 up is (5, -33.3) in the viewBox: one isoline at 45°.
    const grad = draw(Sunbeams, { gradientAngle: 45 }).querySelector('linearGradient')!;
    expect(fadeAt(grad, 50 + 5, 50 - 100 / 3)).toBeCloseTo(fadeAt(grad, 50, 50));
  });
});

describe('a decoration on an outline that reaches past the viewBox', () => {
  const tall: [number, number][] = [[-10, -20], [110, -20], [110, 120], [-10, 120]];
  const region = { x: -10, y: -20, width: 120, height: 140 };
  const boxOf = (el: Element) => ['x', 'y', 'width', 'height'].map((k) => Number(el.getAttribute(k)));
  const drawTall = <P,>(effect: EffectModule<P>, params: P) => draw(effect, params, 200, 30, polygonSampler(tall, 200, 30));

  it('sheen covers the whole outline', () => {
    expect(boxOf(drawTall(Sheen, {}).querySelector('rect')!)).toEqual(Object.values(region));
  });

  it('sunbeams fade over the whole outline', () => {
    const c = drawTall(Sunbeams, { gradientAngle: 90 });
    expect(boxOf(c.querySelector('mask')!)).toEqual(Object.values(region));
    const grad = c.querySelector('linearGradient')!;
    expect(Number(grad.getAttribute('y1'))).toBeCloseTo(-20);
    expect(Number(grad.getAttribute('y2'))).toBeCloseTo(120);
  });

  it('the aqua and metal gloss starts at the outline top', () => {
    for (const effect of [Aqua, Metal] as EffectModule<{ glossExtent: number; specularity?: number }>[]) {
      const rect = drawTall(effect, { glossExtent: 50, specularity: 1 }).querySelector('rect[clip-path]')!;
      expect(boxOf(rect)).toEqual([-10, -20, 120, 70]);
    }
  });
});
