import { describe, expect, it } from 'vitest';
import { spanClamp, spanMap, spanPan, spanFraction, spanShare, spanValue, spanZoom } from './span';

describe('a place along a span', () => {
  const span = { from: 200, to: 1200 };

  it('puts a value at its fraction, and a fraction at its value', () => {
    expect(spanFraction(span, 700)).toBeCloseTo(0.5, 12);
    expect(spanValue(span, 0.5)).toBe(700);
    expect(spanMap(span).toValue(spanMap(span).toFraction(450))).toBeCloseTo(450, 9);
  });

  it("gives the span's end itself at 1, where a hand lerp misses it by an ulp", () => {
    expect(0.7 + 1 * (0.1 - 0.7)).not.toBe(0.1);
    expect(spanValue({ from: 0.7, to: 0.1 }, 1)).toBe(0.1);
  });

  it('runs negative before the span and past 1 after it', () => {
    expect(spanFraction(span, 100)).toBeCloseTo(-0.1, 12);
    expect(spanFraction(span, 1700)).toBeCloseTo(1.5, 12);
  });

  it("measures a length without subtracting the span's start", () => {
    expect(spanShare(span, 250)).toBeCloseTo(0.25, 12);
  });

  it('reads zero for an empty span', () => {
    expect(spanFraction({ from: 5, to: 5 }, 99)).toBe(0);
    expect(spanShare({ from: 5, to: 5 }, 99)).toBe(0);
  });
});

describe('spanZoom', () => {
  const bounds = { from: 0, to: 1000 };

  it('holds the anchor at its place along the track', () => {
    const z = spanZoom(bounds, 250, 0.5, bounds);
    expect(spanFraction(z, 250)).toBeCloseTo(0.25, 9);
    expect(z.to - z.from).toBeCloseTo(500, 9);
  });

  it('never widens past the bounds', () => {
    expect(spanZoom(bounds, 500, 4, bounds)).toEqual(bounds);
  });

  it('narrows no further than the minimum length', () => {
    let z = bounds;
    for (let i = 0; i < 50; i++) z = spanZoom(z, 500, 0.5, bounds, 1);
    expect(z.to - z.from).toBeCloseTo(1, 9);
  });
});

describe('spanPan and spanClamp', () => {
  const bounds = { from: 0, to: 1000 };

  it('shifts both ends together', () => {
    expect(spanPan({ from: 100, to: 600 }, 50, bounds)).toEqual({ from: 150, to: 650 });
  });

  it('stops at the bounds without changing the length', () => {
    expect(spanPan({ from: 100, to: 600 }, -400, bounds)).toEqual({ from: 0, to: 500 });
    expect(spanPan({ from: 100, to: 600 }, 900, bounds)).toEqual({ from: 500, to: 1000 });
  });

  it('shortens a span longer than the bounds to them', () => {
    expect(spanClamp({ from: -500, to: 2000 }, bounds)).toEqual(bounds);
  });

  it('a pan pinned to the end does not start an ulp before the bounds', () => {
    const b = { from: 1.0768832306988128e-107, to: 143045.4262719936 };
    expect(spanPan(b, 1, b).from).toBeGreaterThanOrEqual(b.from);
  });

  it('a pan of nothing gives back the very span', () => {
    const w = { from: 53081.463288690764, to: 219113.85398223755 };
    expect(spanPan(w, 0, { from: -1.5054195573600165e-32, to: 400728.22630727955 })).toEqual(w);
  });
});
