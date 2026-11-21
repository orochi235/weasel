import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SHAPES } from './index';
import { MAX_REPEATS, withDefaults } from './params';
import { BADGE_SHAPES } from '../catalog';

describe('withDefaults', () => {
  it('keeps the default for a key set to undefined', () => {
    expect(withDefaults({ a: 1, b: 2 }, { a: undefined, b: 3 })).toEqual({ a: 1, b: 3 });
  });
});

describe('a shape param set to undefined', () => {
  for (const name of BADGE_SHAPES) {
    const m = SHAPES[name];
    const defaults = m.defaults as Record<string, unknown> | undefined;
    if (!defaults || Object.keys(defaults).length === 0) continue;
    const unset = Object.fromEntries(Object.keys(defaults).map((k) => [k, undefined]));
    it(`${name} draws what its defaults draw`, () => {
      if (m.compose) {
        expect(m.compose(unset as never)).toEqual(m.compose(defaults as never));
      }
      if (m.Component) {
        const C = m.Component;
        const draw = (params: unknown) => render(
          <svg viewBox="0 0 100 100"><C variant="solid" focused params={params as never} phase={0} /></svg>,
        ).container.innerHTML.replace(/_r_[\w]+_|«r\w+»|:r\w+:/g, '');
        expect(draw(unset)).toBe(draw(defaults));
      }
    });
  }
});

describe('a clamped shape param set to NaN', () => {
  const clamped: Record<string, string[]> = {
    crest: ['topInset', 'pointDepth'],
    coffin: ['headX', 'headHalfHeight', 'shoulderX', 'shoulderHalfHeight', 'footX', 'footHalfHeight'],
    house: ['eaveY', 'peakHeight', 'roofOverhang'],
    hexagon: ['tipHeight', 'tipTruncation'],
    notched: ['erosion', 'eccentricity'],
    shield: ['pointDepth', 'shoulderY', 'curveTightness', 'erosion'],
    receipt: ['tearDepth', 'sideToTopRatio'],
    starburst: ['erosion'],
    perforated: ['holeRadius', 'holePitch'],
  };
  for (const [name, keys] of Object.entries(clamped)) {
    const m = SHAPES[name as keyof typeof SHAPES];
    const defaults = m.defaults as Record<string, unknown>;
    for (const key of keys) {
      it(`${name} draws its default ${key}`, () => {
        const nan = { ...defaults, [key]: NaN };
        if (m.compose) expect(m.compose(nan as never)).toEqual(m.compose(defaults as never));
        if (m.Component) {
          const C = m.Component;
          const draw = (params: unknown) => render(
            <svg viewBox="0 0 100 100"><C variant="solid" focused params={params as never} phase={0} /></svg>,
          ).container.innerHTML.replace(/_r_[\w]+_|«r\w+»|:r\w+:/g, '');
          expect(draw(nan)).toBe(draw(defaults));
        }
        if (typeof m.insets === 'function') expect(m.insets(nan as never)).toEqual(m.insets(defaults as never));
      });
    }
  }
});

describe('a repeat count', () => {
  const pathOf = (name: 'sparkler' | 'starburst' | 'receipt', params: Record<string, number>) => {
    const C = SHAPES[name].Component!;
    const { container } = render(
      <svg viewBox="0 0 100 100"><C variant="solid" focused={false} params={params as never} phase={0} /></svg>,
    );
    return container.querySelector('path')!.getAttribute('d')!;
  };
  const vertices = (d: string) => (d.match(/[ML] /g) ?? []).length;

  for (const name of ['sparkler', 'starburst'] as const) {
    it(`${name} draws at least three points from zero or a negative count`, () => {
      expect(vertices(pathOf(name, { points: 0 }))).toBe(6);
      expect(vertices(pathOf(name, { points: -4 }))).toBe(6);
    });
    it(`${name} draws whole points from a fractional count`, () => {
      expect(vertices(pathOf(name, { points: 2.5 }))).toBe(6);
      expect(vertices(pathOf(name, { points: 5.9 }))).toBe(10);
    });
    it(`${name} caps an infinite count`, () => {
      expect(vertices(pathOf(name, { points: Infinity }))).toBe(MAX_REPEATS * 2);
    });
  }
  it('beavis takes its spike count through the same bounds', () => {
    const count = (points: number) => (SHAPES.beavis.compose!({ points }).effects![0].params as { count: number }).count;
    expect(count(Infinity)).toBe(MAX_REPEATS);
    expect(count(NaN)).toBe(3);
    expect(count(5.9)).toBe(5);
  });
  it('receipt keeps its two tears from crossing', () => {
    const xs = (d: string) => [...d.matchAll(/L ([\d.]+) ([\d.]+)/g)].map((m) => Number(m[1]));
    const d = pathOf('receipt', { tearDepth: 1000 });
    const half = d.indexOf('L 0 100');
    expect(Math.min(...xs(d.slice(0, half)))).toBeGreaterThan(50);
    expect(Math.max(...xs(d.slice(half)))).toBeLessThan(50);
  });
  it('receipt caps an infinite tooth count', () => {
    expect(pathOf('receipt', { teeth: Infinity }).length).toBeGreaterThan(0);
  });
});
