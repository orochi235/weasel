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
    for (const value of ['#fff', '#11223344', 'rgb(1 2 3)', 'hsl(10deg 50% 50% / 0.5)', 'oklch(0.5 0.1 200)', 'transparent', 'Red']) {
      expect(parsesAsColor(value, null), value).toBe(true);
    }
    for (const value of ['', '4px', '#ggg', 'var(--x)', 'bold', '1px solid red']) {
      expect(parsesAsColor(value, null), value).toBe(false);
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
});
