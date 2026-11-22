import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { polygonSampler } from '../bases/polygonSampler';
import type { BaseSampler, EffectModule, PerimeterPoint } from '../bases/types';
import Aqua from './Aqua';
import Bevel from './Bevel';
import Bevel2 from './Bevel2';
import Bites from './Bites';
import Metal from './Metal';
import Outline from './Outline';
import Perforations from './Perforations';
import Puffs from './Puffs';
import Rivets from './Rivets';
import Scallops from './Scallops';
import Sheen from './Sheen';
import Spikes from './Spikes';
import Sunbeams from './Sunbeams';
import Woodgrain from './Woodgrain';

const square: [number, number][] = [[0, 0], [100, 0], [100, 100], [0, 100]];

function draw<P>(effect: EffectModule<P>, params: P, boxW = 200, boxH = 30, sampler?: BaseSampler, phase = 0) {
  const Component = effect.Component!;
  const s = sampler ?? polygonSampler(square, boxW, boxH);
  const { container } = render(
    <svg>
      <Component sampler={s} boxW={boxW} boxH={boxH} variant="solid" params={params} phase={phase} />
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

  it('moves its holes along the outline by `phase`, as the bump effects do', () => {
    const s = polygonSampler(square, 200, 30);
    const first = (phase: number) => draw(Perforations, { holeSpacing: 23 }, 200, 30, s, phase).querySelector('ellipse')!;
    const step = s.totalCss / Math.round(s.totalCss / 23);
    const moved = s.perimeterAt(0.75 * step);
    expect(Number(first(0.25).getAttribute('cx'))).toBeCloseTo(moved.x);
    expect(Number(first(0).getAttribute('cx'))).not.toBeCloseTo(moved.x);
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

const circle = (r: number) => (s: number): PerimeterPoint => {
  const a = s / r;
  return { x: r * Math.cos(a), y: r * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) };
};

describe('spikes', () => {
  it('draws no spike for a negative length, on a tight curve as on a straight edge', () => {
    const r = 4;
    const totalCss = 2 * Math.PI * r;
    for (const params of [{ length: -8 }, { vertScale: -2, horzScale: -2, diagonalScale: -2 }]) {
      for (let s = 0; s < totalCss; s += 0.05) {
        const { dx, dy } = Spikes.offsetAt!(s, { params: { count: 3, baseWidth: 6, ...params }, phase: 0, totalCss, perimeterAt: circle(r) });
        expect(Math.hypot(dx, dy)).toBe(0);
      }
    }
  });

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

describe('woodgrain', () => {
  it('draws its knots the same shape on a wide badge as on a square one', () => {
    const aspect = (boxW: number, boxH: number) => {
      const ring = draw(Woodgrain, { knots: 1 }, boxW, boxH).querySelector('ellipse')!;
      return (Number(ring.getAttribute('rx')) * boxW) / (Number(ring.getAttribute('ry')) * boxH);
    };
    expect(aspect(150, 24)).toBeCloseTo(aspect(40, 40));
  });
});

describe('a repeat count', () => {
  it('stops sunbeams and woodgrain at a finite whole count', () => {
    expect(draw(Sunbeams, { count: Infinity }).querySelectorAll('polygon').length).toBe(256);
    expect(draw(Sunbeams, { count: 2.5 }).querySelectorAll('polygon').length).toBe(2);
    const grain = draw(Woodgrain, { lines: Infinity, knots: 1e9 });
    expect(grain.querySelectorAll('path.badge-stroke').length).toBe(256);
    expect(grain.querySelectorAll('ellipse').length).toBe(512);
  });
});

describe('a bump effect param that is not a finite number', () => {
  const totalCss = 200;
  const cases: [string, EffectModule<object>, object][] = [
    ['bites', Bites, { biteSpacing: NaN }],
    ['bites', Bites, { biteRadius: NaN, irregularity: NaN }],
    ['scallops', Scallops, { scallopSpacing: NaN }],
    ['scallops', Scallops, { scallopRadius: NaN, irregularity: NaN }],
    ['puffs', Puffs, { bumpWidth: NaN, puffiness: Infinity, irregularity: NaN }],
    ['spikes', Spikes, { count: NaN, length: Infinity }],
    ['spikes', Spikes, { count: Infinity, baseWidth: NaN, irregularity: NaN, cornerCompensation: NaN }],
  ];
  for (const [name, effect, params] of cases) {
    it(`${name} given ${JSON.stringify(params, (_, v: unknown) => (typeof v === 'number' ? String(v) : v))} keeps the outline finite`, () => {
      for (let s = 0; s < totalCss; s += 0.5) {
        const { dx, dy } = effect.offsetAt!(s, { params, phase: 0, totalCss, perimeterAt: line });
        expect(Number.isFinite(dx) && Number.isFinite(dy)).toBe(true);
      }
    });
  }
});

describe('rivets', () => {
  const centers = (c: Element) => [...c.querySelectorAll('ellipse.badge-bevel-dark')].map((e) => [Number(e.getAttribute('cx')), Number(e.getAttribute('cy'))]);

  it('sit `inset` CSS px in from each corner of a rectangle', () => {
    const [x, y] = centers(draw(Rivets, { inset: 7 }))[0];
    expect(x).toBeCloseTo(7 * (100 / 200));
    expect(y).toBeCloseTo(7 * (100 / 30));
  });

  it('sit inside an outline that does not fill its box, clipped to it', () => {
    const diamond: [number, number][] = [[50, 0], [100, 50], [50, 100], [0, 50]];
    const c = draw(Rivets, { inset: 7 }, 100, 100, polygonSampler(diamond, 100, 100));
    const found = centers(c);
    expect(found).toHaveLength(4);
    for (const [x, y] of found) expect(Math.abs(x - 50) + Math.abs(y - 50)).toBeLessThan(50);
    expect(c.querySelector('g[clip-path]')).not.toBeNull();
  });
});

describe('a light corner', () => {
  for (const [name, effect] of [['sheen', Sheen], ['bevel', Bevel], ['rivets', Rivets]] as const) {
    it(`${name} throws on a lightFrom that is not a corner, an inherited name included`, () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      for (const lightFrom of ['constructor', 'toString', 'top']) {
        expect(() => draw(effect as EffectModule<object>, { lightFrom })).toThrow(RangeError);
      }
      vi.restoreAllMocks();
    });
  }
});

describe('woodgrain on an outline that reaches past the viewBox', () => {
  const tall: [number, number][] = [[-10, -20], [110, -20], [110, 120], [-10, 120]];

  it('runs its grain across the whole outline', () => {
    const c = draw(Woodgrain, { lines: 4, knots: 0 }, 200, 30, polygonSampler(tall, 200, 30));
    const nums = [...c.querySelectorAll('path.badge-stroke')].map((p) => p.getAttribute('d')!.match(/-?[\d.]+/g)!.map(Number));
    for (const n of nums) {
      expect(n[0]).toBeLessThan(-10);
      expect(n[n.length - 2]).toBeGreaterThan(110);
    }
    expect(nums[0][1]).toBeCloseTo(-20 + 140 / 5);
    expect(nums[3][1]).toBeCloseTo(-20 + (4 * 140) / 5);
  });

  it('draws as before on an outline inside the viewBox', () => {
    const d = draw(Woodgrain, { lines: 1, knots: 0 }).querySelector('path.badge-stroke')!.getAttribute('d')!;
    expect(d.startsWith('M -5 50 Q 35 ')).toBe(true);
    expect(d).toMatch(/ 60 50 T 105 /);
  });
});

describe('perforation spacing', () => {
  it('never sets holes closer than twice their radius', () => {
    for (let total = 12; total <= 30; total += 0.75) {
      const boxW = total / 2 - 3;
      const holes = draw(Perforations, { holeRadius: 3, holeSpacing: 6 }, boxW, 3).querySelectorAll('ellipse').length;
      expect(holes === 2 || total / holes >= 6).toBe(true);
    }
  });
});

describe('rivets on an outline that reaches past a corner of its box', () => {
  it('sit `inset` CSS px in from the corner, which is inside the body', () => {
    const tall: [number, number][] = [[-10, -20], [110, -20], [110, 120], [-10, 120]];
    const c = draw(Rivets, { inset: 7 }, 100, 100, polygonSampler(tall, 100, 100));
    const found = [...c.querySelectorAll('ellipse.badge-bevel-dark')].map((e) => [Number(e.getAttribute('cx')), Number(e.getAttribute('cy'))]);
    expect(found).toHaveLength(4);
    for (const [x, y] of found) {
      expect(Math.abs(x - 50)).toBeCloseTo(43);
      expect(Math.abs(y - 50)).toBeCloseTo(43);
    }
  });
});
