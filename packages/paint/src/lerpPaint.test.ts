import { describe, expect, it } from 'vitest';
import { lerpFill, lerpPaint, lerpStroke } from './lerpPaint';

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

  it('fades a missing side in as transparent', () => {
    expect(lerpPaint(undefined, { color: '#0000ff' }, 0.5)).toEqual({ color: '#0000ff', opacity: 0.5 });
  });

  it('interpolates two like gradients stop by stop', () => {
    const a = { kind: 'linear-gradient' as const, from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#000000' }] };
    const b = { ...a, to: { x: 3, y: 0 }, stops: [{ offset: 0, color: '#ffffff' }, { offset: 1, color: '#ffffff' }] };
    const mid = lerpPaint(a, b, 0.5) as typeof a;
    expect(mid.to).toEqual({ x: 2, y: 0 });
    expect(mid.stops[0]!.color).not.toBe('#000000');
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
});
