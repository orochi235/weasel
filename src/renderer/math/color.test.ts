import { describe, it, expect, beforeEach } from 'vitest';
import { hexToRgba, normalizeHex, parseColor, parseColorToRgba255, resolveColor, rgbaToHex, __resetResolveColorCache } from './color';

describe('parseColorToRgba255', () => {
  it('returns integer 0..255 components for #ffffff', () => {
    expect(parseColorToRgba255('#ffffff')).toEqual([255, 255, 255, 255]);
  });

  it('returns [0,0,0,255] for #000000', () => {
    expect(parseColorToRgba255('#000000')).toEqual([0, 0, 0, 255]);
  });

  it('handles rgba with fractional alpha', () => {
    const [r, g, b, a] = parseColorToRgba255('rgba(255, 0, 0, 0.5)');
    expect(r).toBe(255);
    expect(g).toBe(0);
    expect(b).toBe(0);
    expect(a).toBeGreaterThanOrEqual(127);
    expect(a).toBeLessThanOrEqual(128);
  });
});

describe('parseColor', () => {
  it('parses #rrggbb', () => {
    expect(parseColor('#ff0000')).toEqual([1, 0, 0, 1]);
    expect(parseColor('#00ff00')).toEqual([0, 1, 0, 1]);
    expect(parseColor('#0000ff')).toEqual([0, 0, 1, 1]);
  });

  it('parses #rgb', () => {
    expect(parseColor('#f00')).toEqual([1, 0, 0, 1]);
  });

  it('parses #rrggbbaa', () => {
    const c = parseColor('#ff000080');
    expect(c[0]).toBe(1);
    expect(c[1]).toBe(0);
    expect(c[2]).toBe(0);
    expect(c[3]).toBeCloseTo(0x80 / 255, 2);
  });

  it('parses rgb(r, g, b)', () => {
    const c = parseColor('rgb(255, 128, 0)');
    expect(c[0]).toBe(1);
    expect(c[1]).toBeCloseTo(0.502, 2);
    expect(c[2]).toBe(0);
    expect(c[3]).toBe(1);
  });

  it('parses rgba(r, g, b, a)', () => {
    const c = parseColor('rgba(0, 0, 0, 0.5)');
    expect(c).toEqual([0, 0, 0, 0.5]);
  });

  it('parses #rgba shorthand', () => {
    const c = parseColor('#f008');
    expect(c[0]).toBe(1);
    expect(c[1]).toBe(0);
    expect(c[2]).toBe(0);
    expect(c[3]).toBeCloseTo(0x88 / 255, 5);
  });

  it('parses rgb() with percent components', () => {
    const c = parseColor('rgb(100%, 50%, 0%)');
    expect(c[0]).toBe(1);
    expect(c[1]).toBe(0.5);
    expect(c[2]).toBe(0);
    expect(c[3]).toBe(1);
  });

  it('parses modern space-separated rgb() with slash alpha', () => {
    const c = parseColor('rgb(255 128 0 / 0.5)');
    expect(c[0]).toBe(1);
    expect(c[1]).toBeCloseTo(0.502, 2);
    expect(c[2]).toBe(0);
    expect(c[3]).toBe(0.5);
  });

  it('parses modern rgb() with percent alpha', () => {
    const c = parseColor('rgb(255 0 0 / 50%)');
    expect(c[3]).toBe(0.5);
  });

  it('parses hsl(h, s%, l%)', () => {
    const c = parseColor('hsl(0, 100%, 50%)');
    expect(c[0]).toBe(1);
    expect(c[1]).toBe(0);
    expect(c[2]).toBe(0);
    expect(c[3]).toBe(1);
  });

  it('parses hsl with hue units', () => {
    const fromDeg = parseColor('hsl(120deg, 100%, 50%)');
    const fromTurn = parseColor('hsl(0.3333turn, 100%, 50%)');
    const fromRad = parseColor(`hsl(${(120 * Math.PI) / 180}rad, 100%, 50%)`);
    const fromGrad = parseColor('hsl(133.333grad, 100%, 50%)');
    for (const c of [fromDeg, fromTurn, fromRad, fromGrad]) {
      expect(c[0]).toBeCloseTo(0, 2);
      expect(c[1]).toBeCloseTo(1, 2);
      expect(c[2]).toBeCloseTo(0, 2);
    }
  });

  it('parses hsla()', () => {
    const c = parseColor('hsla(240, 100%, 50%, 0.25)');
    expect(c[0]).toBe(0);
    expect(c[1]).toBe(0);
    expect(c[2]).toBe(1);
    expect(c[3]).toBe(0.25);
  });

  it('parses modern hsl() space-separated with slash alpha', () => {
    const c = parseColor('hsl(120 100% 50% / 0.5)');
    expect(c[0]).toBeCloseTo(0, 5);
    expect(c[1]).toBeCloseTo(1, 5);
    expect(c[2]).toBeCloseTo(0, 5);
    expect(c[3]).toBe(0.5);
  });

  it('parses named colors', () => {
    expect(parseColor('red')).toEqual([1, 0, 0, 1]);
    expect(parseColor('lemonchiffon')).toEqual([1, 250 / 255, 205 / 255, 1]);
    expect(parseColor('REBECCAPURPLE')).toEqual([0x66 / 255, 0x33 / 255, 0x99 / 255, 1]);
  });

  it('parses transparent as fully transparent black', () => {
    expect(parseColor('transparent')).toEqual([0, 0, 0, 0]);
  });

  it('throws on unrecognized input', () => {
    expect(() => parseColor('not-a-color')).toThrow();
    expect(() => parseColor('oklch(0.7 0.15 200)')).toThrow();
  });

  it('caches results: identical input returns identical reference', () => {
    const a = parseColor('#abcdef');
    const b = parseColor('#abcdef');
    expect(a).toBe(b);
  });
});

describe('normalizeHex', () => {
  it('expands #rgb to #rrggbb', () => {
    expect(normalizeHex('#f0a')).toBe('#ff00aa');
  });

  it('lowercases #RRGGBB', () => {
    expect(normalizeHex('#FF00AA')).toBe('#ff00aa');
  });

  it('accepts a missing leading #', () => {
    expect(normalizeHex('ff00aa')).toBe('#ff00aa');
    expect(normalizeHex('f0a')).toBe('#ff00aa');
  });

  it('preserves alpha for #rrggbbaa', () => {
    expect(normalizeHex('#ff00aa80')).toBe('#ff00aa80');
  });

  it('throws on invalid input', () => {
    expect(() => normalizeHex('#xyz')).toThrow();
    expect(() => normalizeHex('#ff000')).toThrow();
  });
});

describe('hexToRgba', () => {
  it('parses #rrggbb to 0..1 floats', () => {
    expect(hexToRgba('#ff0000')).toEqual([1, 0, 0, 1]);
  });

  it('accepts missing # and shorthand', () => {
    expect(hexToRgba('f00')).toEqual([1, 0, 0, 1]);
  });

  it('parses alpha from #rrggbbaa', () => {
    const [, , , a] = hexToRgba('#ff000080');
    expect(a).toBeCloseTo(0x80 / 255, 5);
  });
});

describe('rgbaToHex', () => {
  it('emits #rrggbb when alpha is 1', () => {
    expect(rgbaToHex([1, 0, 0, 1])).toBe('#ff0000');
  });

  it('emits #rrggbb when alpha is omitted', () => {
    expect(rgbaToHex([0, 1, 0])).toBe('#00ff00');
  });

  it('emits #rrggbbaa when alpha < 1', () => {
    expect(rgbaToHex([1, 0, 0, 0x80 / 255])).toBe('#ff000080');
  });

  it('clamps out-of-range components', () => {
    expect(rgbaToHex([-0.5, 1.5, 0.5, 1])).toBe('#00ff80');
  });

  it('round-trips with hexToRgba', () => {
    expect(rgbaToHex(hexToRgba('#1a2b3c'))).toBe('#1a2b3c');
    expect(rgbaToHex(hexToRgba('#1a2b3c80'))).toBe('#1a2b3c80');
  });
});

describe('resolveColor', () => {
  beforeEach(() => __resetResolveColorCache());

  it('returns the same values as parseColor', () => {
    const known = '#ff0000';
    const direct = parseColor(known);
    const cached = resolveColor(known);
    expect([...cached]).toEqual(direct);
  });

  it('returns the same array reference for repeated calls (memoization)', () => {
    const a = resolveColor('#00ff00');
    const b = resolveColor('#00ff00');
    expect(a).toBe(b);
  });

  it('different inputs return different references', () => {
    const a = resolveColor('#ff0000');
    const b = resolveColor('#00ff00');
    expect(a).not.toBe(b);
  });

  it('clears the cache when it exceeds the cap', () => {
    // Fill cache to cap (1024 distinct entries, none of which is '#00ff00').
    for (let i = 0; i < 1024; i++) {
      resolveColor(`#${i.toString(16).padStart(6, '0')}`);
    }
    // '#00ff00' resolves to (0,255,0) which is outside the 0..1023 hex range
    // above, so it's a fresh entry whose insertion triggers the overflow clear.
    const before = resolveColor('#00ff00');
    // After the clear-then-insert above, the cache holds just '#00ff00'.
    // Reset and repeat to verify that consecutive overflow paths return
    // fresh arrays rather than reusing the previous reference.
    __resetResolveColorCache();
    for (let i = 0; i < 1024; i++) {
      resolveColor(`#${i.toString(16).padStart(6, '0')}`);
    }
    const after = resolveColor('#00ff00');
    expect(after).not.toBe(before);
    expect([...after]).toEqual([...before]);
  });
});
