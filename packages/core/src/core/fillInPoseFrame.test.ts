import { describe, it, expect } from 'vitest';
import { fillInPoseFrame, fillToBoundsFrame } from './fillInPoseFrame';
import type { FillStyle, GradientFill } from './paint-types';

const STOPS = [
  { offset: 0, color: '#000000' },
  { offset: 1, color: '#ffffff' },
];

/** Left-to-right across the whole box. */
const LINEAR: GradientFill = {
  fill: 'linear-gradient',
  from: { x: 0, y: 0.5 },
  to: { x: 1, y: 0.5 },
  stops: STOPS,
  units: 'bounds',
};

describe('fillInPoseFrame', () => {
  it('maps 0..1 geometry onto the box', () => {
    const out = fillInPoseFrame(LINEAR, { x: 100, y: 200, width: 300, height: 40 });
    expect(out).toMatchObject({
      fill: 'linear-gradient',
      from: { x: 100, y: 220 },
      to: { x: 400, y: 220 },
    });
  });

  it('hands the renderer a frame it can resolve, not the bounds marker', () => {
    const out = fillInPoseFrame(LINEAR, { x: 0, y: 0, width: 10, height: 10 });
    expect(out).toMatchObject({ units: 'local' });
  });

  it('follows a move: the same fill lands wherever the box is', () => {
    const a = fillInPoseFrame(LINEAR, { x: 0, y: 0, width: 100, height: 100 });
    const b = fillInPoseFrame(LINEAR, { x: 500, y: 300, width: 100, height: 100 });
    if (a.fill !== 'linear-gradient' || b.fill !== 'linear-gradient') throw new Error('unreachable');
    expect(b.from.x - a.from.x).toBe(500);
    expect(b.from.y - a.from.y).toBe(300);
  });

  it('follows a resize: the span always matches the box width', () => {
    const wide = fillInPoseFrame(LINEAR, { x: 0, y: 0, width: 800, height: 100 });
    if (wide.fill !== 'linear-gradient') throw new Error('unreachable');
    expect(wide.to.x - wide.from.x).toBe(800);
  });

  it('scales a radius by the box diagonal, which is the width for a square', () => {
    const radial: GradientFill = {
      fill: 'radial-gradient', center: { x: 0.5, y: 0.5 }, radius: 0.5, stops: STOPS, units: 'bounds',
    };
    const out = fillInPoseFrame(radial, { x: 0, y: 0, width: 200, height: 200 });
    expect(out).toMatchObject({ center: { x: 100, y: 100 }, radius: 100 });
  });

  it('moves a conic center but leaves its angle alone', () => {
    const conic: GradientFill = {
      fill: 'conic-gradient', center: { x: 0.5, y: 0.5 }, angle: 1.2, stops: STOPS, units: 'bounds',
    };
    const out = fillInPoseFrame(conic, { x: 10, y: 20, width: 100, height: 60 });
    expect(out).toMatchObject({ center: { x: 60, y: 50 }, angle: 1.2 });
  });

  it('leaves every other fill untouched, by identity', () => {
    const box = { x: 0, y: 0, width: 10, height: 10 };
    const solid: FillStyle = { color: '#ff0000' };
    const screenGradient: FillStyle = { ...LINEAR, units: 'screen' as const };
    const unitless: FillStyle = { ...LINEAR, units: undefined };
    expect(fillInPoseFrame(solid, box)).toBe(solid);
    expect(fillInPoseFrame(screenGradient, box)).toBe(screenGradient);
    expect(fillInPoseFrame(unitless, box)).toBe(unitless);
  });
});

describe('fillToBoundsFrame', () => {
  it('inverts fillInPoseFrame', () => {
    const box = { x: 40, y: 90, width: 250, height: 120 };
    const placed = fillInPoseFrame(LINEAR, box);
    const back = fillToBoundsFrame(placed, box);
    expect(back).toMatchObject({
      fill: 'linear-gradient',
      from: { x: 0, y: 0.5 },
      to: { x: 1, y: 0.5 },
      units: 'bounds',
    });
  });

  it('round-trips a radial radius', () => {
    const radial: GradientFill = {
      fill: 'radial-gradient', center: { x: 0.25, y: 0.75 }, radius: 0.4, stops: STOPS, units: 'bounds',
    };
    const box = { x: 5, y: 5, width: 300, height: 160 };
    const back = fillToBoundsFrame(fillInPoseFrame(radial, box), box);
    if (back.fill !== 'radial-gradient') throw new Error('unreachable');
    expect(back.center.x).toBeCloseTo(0.25);
    expect(back.center.y).toBeCloseTo(0.75);
    expect(back.radius).toBeCloseTo(0.4);
  });

  it('normalizes page-space coordinates, as an SVG import supplies them', () => {
    const userSpace: GradientFill = {
      fill: 'linear-gradient', from: { x: 100, y: 100 }, to: { x: 300, y: 100 }, stops: STOPS,
    };
    const back = fillToBoundsFrame(userSpace, { x: 100, y: 50, width: 200, height: 100 });
    expect(back).toMatchObject({ from: { x: 0, y: 0.5 }, to: { x: 1, y: 0.5 }, units: 'bounds' });
  });

  it('leaves a degenerate box alone rather than dividing by zero', () => {
    const flat = { x: 0, y: 0, width: 0, height: 100 };
    const placed = fillInPoseFrame(LINEAR, { x: 0, y: 0, width: 10, height: 10 });
    expect(fillToBoundsFrame(placed, flat)).toBe(placed);
  });

  it('leaves a solid fill alone', () => {
    const solid: FillStyle = { color: '#ff0000' };
    expect(fillToBoundsFrame(solid, { x: 0, y: 0, width: 10, height: 10 })).toBe(solid);
  });
});
