import { describe, it, expect } from 'vitest';
import {
  isGradientFill,
  sampleGradientStops,
  withGradientKind,
  gradientGeometry,
  gradientForBounds,
} from './gradient';
import type { GradStop, GradientFill } from '@weasel-js/paint';

const BW: GradStop[] = [
  { offset: 0, color: '#000000' },
  { offset: 1, color: '#ffffff' },
];

describe('sampleGradientStops', () => {
  it('returns the endpoint colors at the ends', () => {
    expect(sampleGradientStops(BW, 0)).toBe('#000000');
    expect(sampleGradientStops(BW, 1)).toBe('#ffffff');
  });

  it('interpolates linearly between neighbors', () => {
    expect(sampleGradientStops(BW, 0.5)).toBe('#808080');
  });

  it('extends flat past either end rather than extrapolating', () => {
    expect(sampleGradientStops(BW, -5)).toBe('#000000');
    expect(sampleGradientStops(BW, 5)).toBe('#ffffff');
  });

  it('sorts unordered stops before sampling', () => {
    const unordered: GradStop[] = [
      { offset: 1, color: '#ffffff' },
      { offset: 0, color: '#000000' },
    ];
    expect(sampleGradientStops(unordered, 0.5)).toBe('#808080');
  });

  it('interpolates alpha, so a fade to transparent samples half-transparent', () => {
    const fade: GradStop[] = [
      { offset: 0, color: '#ff0000ff' },
      { offset: 1, color: '#ff000000' },
    ];
    expect(sampleGradientStops(fade, 0.5)).toBe('#ff000080');
  });

  it('renders coincident stops as a hard break rather than a ramp', () => {
    const hard: GradStop[] = [
      { offset: 0, color: '#000000' },
      { offset: 0.5, color: '#000000' },
      { offset: 0.5, color: '#ffffff' },
      { offset: 1, color: '#ffffff' },
    ];
    // Which color lands exactly on the discontinuity is an arbitrary
    // tie-break; that it is flat on both sides of it is the contract.
    expect(sampleGradientStops(hard, 0.49)).toBe('#000000');
    expect(sampleGradientStops(hard, 0.51)).toBe('#ffffff');
  });

  it('does not produce NaN when two stops share an offset', () => {
    const coincident: GradStop[] = [
      { offset: 0.5, color: '#000000' },
      { offset: 0.5, color: '#ffffff' },
    ];
    expect(sampleGradientStops(coincident, 0.5)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('handles the degenerate lists a mid-edit stop strip can produce', () => {
    expect(sampleGradientStops([], 0.5)).toBe('rgba(0,0,0,0)');
    expect(sampleGradientStops([{ offset: 0.2, color: '#123456' }], 0.9)).toBe('#123456');
  });
});

describe('gradientGeometry', () => {
  it('reads a linear gradient as midpoint, half-length and direction', () => {
    const g = gradientGeometry({
      fill: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, stops: BW,
    });
    expect(g.center).toEqual({ x: 50, y: 0 });
    expect(g.radius).toBe(50);
    expect(g.angle).toBe(0);
  });
});

describe('withGradientKind', () => {
  const linear: GradientFill = {
    fill: 'linear-gradient',
    from: { x: 0, y: 0 },
    to: { x: 100, y: 0 },
    stops: BW,
    units: 'local',
    opacity: 0.5,
  };

  it('is identity when the kind already matches', () => {
    expect(withGradientKind(linear, 'linear-gradient')).toBe(linear);
  });

  it('carries stops, units and opacity across a kind change', () => {
    const radial = withGradientKind(linear, 'radial-gradient');
    expect(radial.stops).toBe(BW);
    expect(radial.units).toBe('local');
    expect(radial.opacity).toBe(0.5);
  });

  it('keeps the center fixed when going linear → radial', () => {
    const radial = withGradientKind(linear, 'radial-gradient');
    expect(radial).toMatchObject({ fill: 'radial-gradient', center: { x: 50, y: 0 }, radius: 50 });
  });

  it('round-trips linear → radial → linear back to the original segment', () => {
    const back = withGradientKind(withGradientKind(linear, 'radial-gradient'), 'linear-gradient');
    expect(back).toMatchObject({ from: { x: 0, y: 0 }, to: { x: 100, y: 0 } });
  });

  it('loses segment direction through radial, which stores no angle, but keeps center and length', () => {
    const vertical: GradientFill = {
      fill: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 0, y: 80 }, stops: BW,
    };
    const back = withGradientKind(withGradientKind(vertical, 'radial-gradient'), 'linear-gradient');
    if (back.fill !== 'linear-gradient') throw new Error('unreachable');
    expect(back).toMatchObject({ from: { x: -40, y: 40 }, to: { x: 40, y: 40 } });
  });

  it('preserves direction and center through conic, which stores an angle but no length', () => {
    const vertical: GradientFill = {
      fill: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 0, y: 80 }, stops: BW,
    };
    const back = withGradientKind(withGradientKind(vertical, 'conic-gradient'), 'linear-gradient');
    if (back.fill !== 'linear-gradient') throw new Error('unreachable');
    expect(back.from.x).toBeCloseTo(0);
    expect(back.to.x).toBeCloseTo(0);
    expect(back.to.y).toBeGreaterThan(back.from.y);
    expect((back.from.y + back.to.y) / 2).toBeCloseTo(40);
  });

  it('carries the angle into a conic gradient', () => {
    const conic = withGradientKind(linear, 'conic-gradient');
    expect(conic).toMatchObject({ fill: 'conic-gradient', center: { x: 50, y: 0 }, angle: 0 });
  });

  it('gives a conic gradient a usable arm, so conic → linear is not degenerate', () => {
    const conic: GradientFill = {
      fill: 'conic-gradient', center: { x: 10, y: 10 }, angle: 0, stops: BW,
    };
    const asLinear = withGradientKind(conic, 'linear-gradient');
    if (asLinear.fill !== 'linear-gradient') throw new Error('unreachable');
    expect(Math.hypot(asLinear.to.x - asLinear.from.x, asLinear.to.y - asLinear.from.y)).toBeGreaterThan(0);
  });
});

describe('gradientForBounds', () => {
  const bounds = { x: 10, y: 20, width: 100, height: 50 };

  it('spans a linear gradient across the box, left to right', () => {
    expect(gradientForBounds('linear-gradient', bounds, BW, 'local')).toMatchObject({
      fill: 'linear-gradient',
      from: { x: 10, y: 45 },
      to: { x: 110, y: 45 },
      units: 'local',
    });
  });

  it('centers a radial gradient and sizes it to the larger side', () => {
    expect(gradientForBounds('radial-gradient', bounds, BW)).toMatchObject({
      fill: 'radial-gradient',
      center: { x: 60, y: 45 },
      radius: 50,
    });
  });

  it('centers a conic gradient at zero angle', () => {
    expect(gradientForBounds('conic-gradient', bounds, BW)).toMatchObject({
      fill: 'conic-gradient',
      center: { x: 60, y: 45 },
      angle: 0,
    });
  });
});

describe('conic conversions respect the unit system', () => {
  const conicIn = (units: GradientFill['units']): GradientFill => ({
    fill: 'conic-gradient', center: { x: 0.5, y: 0.5 }, angle: 0, stops: BW, units,
  });

  it('keeps a bounds conic → radial inside its own box', () => {
    const radial = withGradientKind(conicIn('bounds'), 'radial-gradient');
    if (radial.fill !== 'radial-gradient') throw new Error('unreachable');
    // A pixel-flavored default here would be fifty times the box.
    expect(radial.radius).toBeLessThanOrEqual(1);
    expect(radial.radius).toBeGreaterThan(0);
  });

  it('keeps a bounds conic → linear inside its own box', () => {
    const linear = withGradientKind(conicIn('bounds'), 'linear-gradient');
    if (linear.fill !== 'linear-gradient') throw new Error('unreachable');
    for (const p of [linear.from, linear.to]) {
      expect(p.x).toBeGreaterThanOrEqual(-0.01);
      expect(p.x).toBeLessThanOrEqual(1.01);
    }
  });

  it('still uses a pixel-scale arm for a gradient in absolute units', () => {
    const radial = withGradientKind(conicIn('world'), 'radial-gradient');
    if (radial.fill !== 'radial-gradient') throw new Error('unreachable');
    expect(radial.radius).toBeGreaterThan(1);
  });
});

describe('isGradientFill', () => {
  const stops = [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }];

  it('accepts all three gradient kinds', () => {
    expect(isGradientFill({ fill: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, stops })).toBe(true);
    expect(isGradientFill({ fill: 'radial-gradient', center: { x: 0, y: 0 }, radius: 1, stops })).toBe(true);
    expect(isGradientFill({ fill: 'conic-gradient', center: { x: 0, y: 0 }, angle: 0, stops })).toBe(true);
  });

  it('rejects everything else, absence included', () => {
    expect(isGradientFill({ fill: 'solid', color: '#f00' })).toBe(false);
    expect(isGradientFill(null)).toBe(false);
    expect(isGradientFill(undefined)).toBe(false);
  });
});
