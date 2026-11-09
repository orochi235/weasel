import { describe, expect, it } from 'vitest';
import { IMPERIAL_INCHES, METRIC_MM, PIXELS, scaleBar, type UnitScope } from '@weasel-js/quantity';
import { rulerTicks } from './ticks';

const INCHES: UnitScope = { system: IMPERIAL_INCHES };
const MM: UnitScope = { system: METRIC_MM, scale: 1 / 25.4 };

const majors = (t: ReturnType<typeof rulerTicks>) => t.ticks.filter((k) => k.major);

describe('rulerTicks', () => {
  it('labels the step scaleBar picks, counted from world zero', () => {
    const t = rulerTicks({ majorPx: 140, pxPerUnit: 10, start: 0, length: 400, scopes: [INCHES] });
    expect(t).toMatchObject({ step: 12, unit: 'ft', subdivisions: 10, magnification: 1 });
    expect(t.step).toBe(scaleBar({ pxPerUnit: 10, scopes: [INCHES], maxPx: 140 }).length);
    expect(majors(t).map((k) => [k.at, k.label])).toEqual([[0, '0'], [120, '1'], [240, '2'], [360, '3']]);
  });

  it('cuts each step into as many parts as stay minorPx apart', () => {
    const t = rulerTicks({ majorPx: 140, pxPerUnit: 10, start: 0, length: 120, scopes: [INCHES], minorPx: 30 });
    expect(t.subdivisions).toBe(2);
    expect(t.ticks.map((k) => [k.at, k.major])).toEqual([[0, true], [60, false], [120, true]]);
    expect(rulerTicks({ majorPx: 140, pxPerUnit: 10, start: 0, length: 120, scopes: [INCHES], minorPx: 200 }).subdivisions).toBe(1);
  });

  it('follows a pan: ticks sit where their world positions land on screen', () => {
    const t = rulerTicks({ majorPx: 140, pxPerUnit: 10, start: -5, length: 130, scopes: [INCHES], minorPx: 200 });
    expect(majors(t).map((k) => [k.at, k.label])).toEqual([[50, '0']]);
    const back = rulerTicks({ majorPx: 140, pxPerUnit: 10, start: -30, length: 120, scopes: [INCHES], minorPx: 200 });
    expect(majors(back).map((k) => [k.at, k.label])).toEqual([[60, '-2']]);
  });

  it('reads from the origin it is given', () => {
    const t = rulerTicks({ majorPx: 140, pxPerUnit: 10, start: 0, length: 200, scopes: [INCHES], origin: 6, minorPx: 200 });
    expect(majors(t).map((k) => [k.at, k.label])).toEqual([[60, '0'], [180, '1']]);
  });

  it('reads a nested scope in its own units', () => {
    // 4 px an inch: scaleBar's metric step under 100 px is 500 mm, labeled in cm.
    const t = rulerTicks({ pxPerUnit: 4, start: 0, length: 300, scopes: [INCHES, MM], minorPx: 1000 });
    expect(t).toMatchObject({ step: 500, unit: 'cm' });
    expect(majors(t).map((k) => k.label)).toEqual(['0', '50', '100', '150']);
    expect(majors(t)[1]!.at).toBeCloseTo(500 / 25.4 * 4);
  });

  it('reads a frame drawn at a declared magnification by its true lengths', () => {
    // An inch of the frame is 4 px: the step is 2 ft, 96 px apart, labeled 2, 4.
    const t = rulerTicks({ majorPx: 140, pxPerUnit: 10, start: 0, length: 200, scopes: [INCHES, { ...INCHES, drawnAt: 0.4 }], minorPx: 1000 });
    expect(t).toMatchObject({ step: 24, unit: 'ft', magnification: 0.4 });
    expect(majors(t).map((k) => [Math.round(k.at * 1e6) / 1e6, k.label])).toEqual([[0, '0'], [96, '2'], [192, '4']]);
  });

  it('labels fractional steps without float noise', () => {
    // 1000 px an inch: the step is 0.1 in.
    const t = rulerTicks({ pxPerUnit: 1000, start: 0, length: 350, scopes: [INCHES], minorPx: 1000 });
    expect(majors(t).map((k) => k.label)).toEqual(['0', '0.1', '0.2', '0.3']);
  });

  it('runs along a flipped axis in screen order', () => {
    const t = rulerTicks({ majorPx: 140, pxPerUnit: -10, start: 0, length: 250, scopes: [INCHES], minorPx: 1000 });
    expect(majors(t).map((k) => [k.at, k.label])).toEqual([[0, '0'], [120, '-1'], [240, '-2']]);
  });

  it('lays out nothing zoomed out past the longest step, where labeled ticks sit under a pixel apart', () => {
    const t = rulerTicks({ pxPerUnit: 1e-7, start: 0, length: 1000, scopes: [{ system: PIXELS }] });
    expect(t.ticks).toEqual([]);
  });

  it('lays out nothing along a ruler with no length', () => {
    expect(rulerTicks({ majorPx: 140, pxPerUnit: 10, start: 0, length: 0, scopes: [INCHES] }).ticks).toEqual([]);
  });
});
