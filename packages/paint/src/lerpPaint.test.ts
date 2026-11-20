import { describe, expect, it } from 'vitest';
import { lerpFill, lerpPaint, lerpStroke } from './lerpPaint';
import type { Stroke } from './paint';

describe('lerpPaint', () => {
  it('is each end at 0 and 1', () => {
    expect(lerpPaint({ color: '#ff0000' }, { color: '#0000ff' }, 0)).toEqual({ color: '#ff0000' });
    expect(lerpPaint({ color: '#ff0000' }, { color: '#0000ff' }, 1)).toEqual({ color: '#0000ff' });
  });

  it('mixes through OKLab, not sRGB', () => {
    // An sRGB midpoint of red and lime is #808000, a dull olive; OKLab's is
    // lighter and yellower.
    const mid = lerpPaint({ color: '#ff0000' }, { color: '#00ff00' }, 0.5) as { color: string };
    expect(mid.color).not.toBe('#808000');
    const g = parseInt(mid.color.slice(3, 5), 16);
    expect(g).toBeGreaterThan(0x90);
  });

  it("turns a conic gradient's start angle the short way round", () => {
    const stops = [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }];
    const conic = (angle: number) => ({ kind: 'conic-gradient' as const, center: { x: 0, y: 0 }, angle, stops });
    const mid = lerpPaint(conic(3), conic(-3), 0.5) as { angle: number };
    expect(Math.abs(Math.abs(mid.angle) - Math.PI)).toBeLessThan(1e-9);
    expect((lerpPaint(conic(6.2), conic(0.1), 1) as { angle: number }).angle).toBe(0.1);
    expect((lerpPaint(conic(6.2), conic(0.1), 0.5) as { angle: number }).angle).toBeCloseTo(6.2 + (0.1 + 2 * Math.PI - 6.2) / 2);
  });

  it('keeps the color of a fully transparent solid', () => {
    const clearRed = { color: '#ff0000', opacity: 0 };
    expect(lerpPaint(clearRed, clearRed, 0)).toEqual({ color: '#ff0000', opacity: 0 });
    expect(lerpPaint(undefined, { color: '#ff0000' }, 0)).toEqual({ color: '#ff0000', opacity: 0 });
    expect(lerpPaint({ color: '#ff0000' }, undefined, 1)).toEqual({ color: '#ff0000', opacity: 0 });
  });

  it('fades a missing side in as transparent', () => {
    expect(lerpPaint(undefined, { color: '#0000ff' }, 0.5)).toEqual({ color: '#0000ff', opacity: 0.5 });
  });

  it('keeps a gradient stop\'s alpha as it interpolates', () => {
    const a = { kind: 'linear-gradient' as const, from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, stops: [{ offset: 0, color: '#ff000000' }, { offset: 1, color: '#ff0000' }] };
    const b = { ...a, stops: [{ offset: 0, color: '#ff000000' }, { offset: 1, color: '#0000ff80' }] };
    const at0 = lerpPaint(a, b, 0) as typeof a;
    expect(at0.stops.map((s) => s.color)).toEqual(['#ff000000', '#ff0000']);
    const at1 = lerpPaint(a, b, 1) as typeof a;
    expect(at1.stops.map((s) => s.color)).toEqual(['#ff000000', '#0000ff80']);
    const mid = lerpPaint(a, b, 0.5) as typeof a;
    expect(parseInt(mid.stops[1]!.color.slice(7, 9), 16)).toBeCloseTo(0xc0, -1);
  });

  it('interpolates two like gradients stop by stop', () => {
    const a = { kind: 'linear-gradient' as const, from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#000000' }] };
    const b = { ...a, to: { x: 3, y: 0 }, stops: [{ offset: 0, color: '#ffffff' }, { offset: 1, color: '#ffffff' }] };
    const mid = lerpPaint(a, b, 0.5) as typeof a;
    expect(mid.to).toEqual({ x: 2, y: 0 });
    expect(mid.stops[0]!.color).not.toBe('#000000');
  });

  it('pairs stops by offset, whatever order each list holds them in', () => {
    const a = { kind: 'linear-gradient' as const, from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }] };
    const b = { ...a, stops: [a.stops[1], a.stops[0]] };
    const mid = lerpPaint(a, b, 0.5) as typeof a;
    expect(mid.stops).toEqual([{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }]);
  });

  it('switches halfway between unlike paints', () => {
    const hatch = { kind: 'hatch' as const, color: '#000' };
    expect(lerpPaint(hatch, { color: '#fff' }, 0.4)).toBe(hatch);
  });
});

describe('lerpFill and lerpStroke', () => {
  it('keeps a fill that neither side has absent', () => {
    expect(lerpFill(null, null, 0.7)).toBeNull();
  });

  it('interpolates stroke width, and thins a missing stroke from zero', () => {
    expect(lerpStroke({ width: 2, cap: 'round' }, { width: 6 }, 0.25)).toEqual({ width: 3, cap: 'round' });
    expect(lerpStroke(null, { width: 4, paint: { color: '#000000' } }, 0.5)).toMatchObject({ width: 2 });
  });

  it('slides a dash offset, from none as zero', () => {
    expect(lerpStroke({ width: 1, dash: [4, 4], dashOffset: 2 }, { width: 1, dash: [4, 4], dashOffset: 6 }, 0.25))
      .toEqual({ width: 1, dash: [4, 4], dashOffset: 3 });
    expect(lerpStroke({ width: 1, dash: [4, 4] }, { width: 1, dash: [4, 4], dashOffset: 8 }, 0.5)?.dashOffset).toBe(4);
  });
});

describe('lerpStroke per-anchor arrays', () => {
  const s = (vertexWidths: Stroke['vertexWidths'], vertexColors?: number[]): Stroke => ({ paint: { color: '#000' }, width: 2, vertexWidths, ...(vertexColors ? { vertexColors } : {}) });

  it('keeps them at either end', () => {
    const a = s([1, 8, 1], [1, 0, 0, 1, 0, 0, 1, 1]);
    expect(lerpStroke(a, a, 0)).toMatchObject({ vertexWidths: [1, 8, 1], vertexColors: [1, 0, 0, 1, 0, 0, 1, 1] });
    expect(lerpStroke(a, a, 1)).toMatchObject({ vertexWidths: [1, 8, 1] });
  });

  it('interpolates arrays of one length, reading a missing entry as the width', () => {
    const mid = lerpStroke(s([2, 8, { left: 1, right: 3 }], [0, 0, 0, 1]), s([4, undefined as unknown as number, 2], [1, 1, 1, 1]), 0.5)!;
    expect(mid.vertexWidths).toEqual([3, 5, { left: 1, right: 2 }]);
    expect(mid.vertexColors).toEqual([0.5, 0.5, 0.5, 1]);
  });

  it("takes the nearer side's array when the lengths differ", () => {
    expect(lerpStroke(s([1, 2]), s([3, 4, 5]), 0.25)!.vertexWidths).toEqual([1, 2]);
    expect(lerpStroke(s([1, 2]), s(undefined), 0.75)!.vertexWidths).toBeUndefined();
    expect(lerpStroke(null, s([3, 4]), 0.25)!.vertexWidths).toEqual([3, 4]);
  });
});
