import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWithIcons as render } from '../../testing/withIcons';
import { arcShape, lineShape, type ArcTrackSpec } from '@weasel-js/geom';
import { createRecentColorsStore } from '../RecentColors';
import { SwatchStrip } from '../SwatchStrip';
import type { SwatchPalette } from '../SwatchStrip';
import { SwatchGrid, type SwatchGridOption } from './SwatchGrid';
import { ringStep } from './SwatchRings';

// jsdom lays nothing out and applies no stylesheet: a swatch is 20 square, anything else 40 wide, and rings have no gap.
const realOffset = ['offsetWidth', 'offsetHeight'].map((k) => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)!] as const);
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return this.hasAttribute('data-swatch') ? 20 : 40; } });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get(this: HTMLElement) { return this.hasAttribute('data-swatch') ? 20 : 16; } });
});
afterAll(() => {
  for (const [k, d] of realOffset) Object.defineProperty(HTMLElement.prototype, k, d);
});
afterEach(cleanup);

const C = { x: 200, y: 200 };
const arc = (spec: Partial<ArcTrackSpec>) => arcShape({ center: C, radius: 100, start: 270, end: 90, ...spec });
const ARCS = {
  'top, clockwise': arc({}),
  'top, counterclockwise': arc({ start: 90, end: 270, direction: 'ccw' }),
  'bottom, counterclockwise': arc({ direction: 'ccw' }),
  'bottom, clockwise': arc({ start: 90, end: 270 }),
};

const options = (n: number): SwatchGridOption[] => Array.from({ length: n }, (_, i) => ({ value: `#${String(i).padStart(2, '0')}0000ff`, label: `c${i}` }));

const at = (el: Element) => {
  const style = (el as HTMLElement).style;
  return { x: Number.parseFloat(style.getPropertyValue('--at-x')), y: Number.parseFloat(style.getPropertyValue('--at-y')) };
};
const radius = (el: Element) => Math.hypot(at(el).x - C.x, at(el).y - C.y);
/** Angle about the center, clockwise from 12 o'clock, in radians. */
const angle = (el: Element) => Math.atan2(at(el).x - C.x, C.y - at(el).y);
/** The turn from `a` to `b`, the short way. */
const turn = (a: Element, b: Element) => {
  const d = angle(b) - angle(a);
  return Math.atan2(Math.sin(d), Math.cos(d));
};
const ring = (k: number) => [...document.querySelectorAll(`[data-ring="${k}"] [data-swatch]`)];

describe('SwatchGrid along a curve', () => {
  for (const [name, shape] of Object.entries(ARCS)) {
    test(`${name}: row k lies on the arc k rows in, its swatches a pitch apart in reading order`, () => {
      render(<SwatchGrid options={options(6)} columns={3} onChange={() => {}} aria-label="Colors" shape={shape} />);
      expect(ring(0)).toHaveLength(3);
      expect(ring(1)).toHaveLength(3);
      for (const el of ring(0)) expect(radius(el)).toBeCloseTo(100, 2);
      for (const el of ring(1)) expect(radius(el)).toBeCloseTo(80, 2);
      for (const [k, r] of [[0, 100], [1, 80]] as const) {
        const xs = ring(k).map((el) => at(el).x);
        expect(xs[1]!).toBeGreaterThan(xs[0]!);
        expect(xs[2]!).toBeGreaterThan(xs[1]!);
        // 20 px along a ring of radius r is 20 / r of turn.
        expect(Math.abs(turn(ring(k)[0]!, ring(k)[1]!))).toBeCloseTo(20 / r, 3);
      }
    });
  }

  test('outside a curve it is the grid it always was', () => {
    render(<SwatchGrid options={options(6)} columns={3} onChange={() => {}} aria-label="Colors" shape={lineShape({ x: 0, y: 0 }, { x: 100, y: 0 })} />);
    expect(document.querySelector('[data-ring]')).toBeNull();
    expect((screen.getAllByRole('button')[0] as HTMLElement).style.getPropertyValue('--at-x')).toBe('');
  });

  test('Home and End still reach the first and last swatch', () => {
    render(<SwatchGrid options={options(6)} columns={3} onChange={() => {}} aria-label="Colors" shape={ARCS['top, clockwise']} />);
    const b = (i: number) => screen.getByRole('button', { name: `c${i}` });
    b(1).focus();
    fireEvent.keyDown(b(1), { key: 'End' });
    expect(b(5)).toHaveFocus();
    fireEvent.keyDown(b(5), { key: 'Home' });
    expect(b(0)).toHaveFocus();
  });

  test('one tab stop, on the current swatch', () => {
    render(<SwatchGrid options={options(6)} columns={3} value={options(6)[4]!.value} onChange={() => {}} aria-label="Colors" shape={ARCS['top, clockwise']} />);
    const stops = screen.getAllByRole('button').filter((el) => el.tabIndex === 0);
    expect(stops.map((el) => el.getAttribute('aria-label'))).toEqual(['c4']);
    expect(stops[0]).toHaveAttribute('aria-current', 'true');
  });

  test('rows past where the arc bends too tight share the last ring that fits', () => {
    // Radius 50, rows 20 apart: ring 1 at 30 keeps a row's clearance off the center, ring 2 at 10 would not.
    render(<SwatchGrid options={options(12)} columns={3} onChange={() => {}} aria-label="Colors" shape={arc({ radius: 50 })} />);
    expect(document.querySelector('[data-ring="2"]')).toBeNull();
    expect(ring(0)).toHaveLength(3);
    expect(ring(1)).toHaveLength(9);
    for (const el of ring(1)) expect(radius(el)).toBeCloseTo(30, 2);
  });
});

const WARM: SwatchPalette = { id: 'warm', name: 'Warm', columns: 2, colors: options(4) };
const COOL: SwatchPalette = { id: 'cool', name: 'Cool', columns: 2, colors: [{ value: '#0000ffff', label: 'Blue' }] };

describe('SwatchStrip along a curve', () => {
  test('the recent rows lie outermost, the palette rows go on further in, each led by its heading', () => {
    const store = createRecentColorsStore({ storage: null });
    store.record(['#111111ff', '#222222ff', '#333333ff']);
    render(<SwatchStrip store={store} palettes={[WARM]} columns={2} onChange={() => {}} shape={ARCS['top, clockwise']} />);
    const recent = screen.getByRole('group', { name: 'Recent colors' });
    const warm = screen.getByRole('group', { name: 'Warm' });
    expect([...recent.querySelectorAll('[data-ring]')].map((el) => el.getAttribute('data-ring'))).toEqual(['0', '1']);
    expect([...warm.querySelectorAll('[data-ring]')].map((el) => el.getAttribute('data-ring'))).toEqual(['0', '1']);
    const radii = (group: HTMLElement) => [...group.querySelectorAll('[data-ring]')].map((r) => radius(r.querySelector('[data-swatch]')!));
    expect(radii(recent).map((r) => Math.round(r))).toEqual([100, 80]);
    expect(radii(warm).map((r) => Math.round(r))).toEqual([60, 40]);
    for (const [group, heading] of [[recent, 'Recent'], [warm, 'Warm']] as const) {
      const first = group.querySelector('[data-ring]')!.querySelector('[data-ring-item]')!;
      expect(first).toHaveAttribute('data-ring-item', 'lead');
      expect(first).toHaveTextContent(heading);
      expect(radius(first)).toBeCloseTo(radii(group)[0]!, 2);
    }
  });

  test('with more than one palette the picker leads the palette ring, and no recents is said on its ring', () => {
    render(<SwatchStrip store={createRecentColorsStore({ storage: null })} palettes={[WARM, COOL]} onChange={() => {}} shape={ARCS['top, clockwise']} />);
    const recent = screen.getByRole('group', { name: 'Recent colors' });
    expect(within(recent).getByText('No recent colors').closest('[data-ring-item]')).toHaveAttribute('data-ring-item', 'empty');
    const lead = screen.getByRole('group', { name: 'Warm' }).querySelector('[data-ring-item="lead"]')!;
    expect(within(lead as HTMLElement).getByRole('button', { name: /Palette/ })).toBeInTheDocument();
  });
});

describe('ringStep', () => {
  // Two rings of three, ring 1 inside ring 0: on a top arc inside is down the screen, on a bottom arc up it.
  const top = [{ x: 0, y: 0 }, { x: 10, y: -2 }, { x: 20, y: 0 }, { x: 2, y: 10 }, { x: 10, y: 8 }, { x: 18, y: 10 }];
  const bottom = top.map(({ x, y }) => ({ x, y: -y }));
  const right = top.map(({ x, y }) => ({ x: -y, y: x }));
  const step = (key: { x: number; y: number }, i: number, centers: typeof top) => ringStep(key, i, 3, centers);
  const [L, R, U, D] = [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }];

  test('on a top arc Down goes in and Right along', () => {
    expect(step(D, 1, top)).toBe(4);
    expect(step(U, 4, top)).toBe(1);
    expect(step(R, 1, top)).toBe(2);
    expect(step(L, 1, top)).toBe(0);
  });

  test('on a bottom arc Down goes out, not in', () => {
    expect(step(D, 4, bottom)).toBe(1);
    expect(step(U, 1, bottom)).toBe(4);
    expect(step(R, 1, bottom)).toBe(2);
  });

  test('down a right-hand arc Left goes in and Down along', () => {
    expect(step(L, 1, right)).toBe(4);
    expect(step(D, 1, right)).toBe(2);
  });

  test('an arrow with no neighbor its way stays put', () => {
    expect(step(U, 1, top)).toBe(-1);
    expect(step(L, 0, top)).toBe(-1);
  });
});
