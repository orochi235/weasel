import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsesAsColor } from './cssColor';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parsesAsColor', () => {
  it('asks the browser when it can', () => {
    const supports = (value: string) => value === 'rebeccapurple';
    expect(parsesAsColor('rebeccapurple', supports)).toBe(true);
    expect(parsesAsColor('#fff', supports)).toBe(false);
  });

  it('falls back to a parser without CSS.supports', () => {
    for (const value of ['#fff', '#11223344', 'rgb(1 2 3)', 'hsl(10deg 50% 50% / 0.5)', 'oklch(0.5 0.1 200)', 'color-mix(in srgb, red, rgb(0 0 0))', 'transparent', 'Red', 'coral', 'RebeccaPurple', 'darkgray']) {
      expect(parsesAsColor(value, null), value).toBe(true);
    }
    for (const value of ['', '4px', '#ggg', 'var(--x)', 'bold', '1px solid red', 'rgb(0 0 0) } body { background: url(x)', 'rgb(0 0 0); color: hsl(0 0% 0%)', 'rgb(0 0 0) 0 2px rgb(1 1 1)', 'rgb(0,0,0) url(x)', 'rgb()', 'rgb(0 0 0']) {
      expect(parsesAsColor(value, null), value).toBe(false);
    }
  });

  it('without CSS.supports, takes a function parseColor reads only where it parses', () => {
    for (const value of ['rgb(nonsense)', 'hsl(1 2)', 'rgb( )', 'oklch(0.5 0.1)', 'rgba(1, 2, 3, 4, 5)']) {
      expect(parsesAsColor(value, null), value).toBe(false);
    }
    for (const value of ['rgb(from red r g b)', 'rgb(calc(1) 2 3)', 'lab(50% 20 30)', 'color(display-p3 1 0 0)']) {
      expect(parsesAsColor(value, null), value).toBe(true);
    }
  });

  it('defaults to CSS.supports for color where the DOM has it', () => {
    const supports = vi.fn((property: string, value: string) => property === 'color' && value === 'papayawhip');
    vi.stubGlobal('CSS', { supports });
    expect(parsesAsColor('papayawhip')).toBe(true);
    expect(parsesAsColor('#abc')).toBe(false);
    expect(supports).toHaveBeenCalledWith('color', '#abc');
  });

  it('defaults to the parser where the DOM has no CSS.supports', () => {
    vi.stubGlobal('CSS', undefined);
    expect(parsesAsColor('#abc')).toBe(true);
    expect(parsesAsColor('12px')).toBe(false);
    vi.stubGlobal('CSS', {});
    expect(parsesAsColor('#abc')).toBe(true);
    expect(parsesAsColor('12px')).toBe(false);
  });

  it('does not take a CSS-wide keyword for a color, though every property supports one', () => {
    for (const word of ['inherit', 'initial', 'unset', 'revert', 'revert-layer', ' Inherit ']) {
      expect(parsesAsColor(word, () => true)).toBe(false);
    }
  });

  it('turns away brackets, braces, semicolons and deep nesting before asking the browser', () => {
    const asked = () => {
      throw new Error('asked the browser');
    };
    for (const v of ['['.repeat(20_000), 'rgb(0 0 0)]', 'red;', '{red}', `rgb${'('.repeat(17)}0${')'.repeat(17)}`]) {
      expect(parsesAsColor(v, asked)).toBe(false);
    }
    expect(parsesAsColor('rgb(from color-mix(in srgb, red, blue) r g b)', () => true)).toBe(true);
  });
});
