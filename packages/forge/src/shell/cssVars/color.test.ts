import { describe, expect, it } from 'vitest';
import { parsesAsColor, toHex } from './color';

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

  it('uses the parser by default where the DOM has no CSS.supports', () => {
    expect(typeof CSS === 'undefined' || typeof CSS.supports !== 'function').toBe(true);
    expect(parsesAsColor('#abc')).toBe(true);
    expect(parsesAsColor('12px')).toBe(false);
  });
});

describe('toHex', () => {
  it('gives the six-digit hex a color input takes', () => {
    expect(toHex('#ABC')).toBe('#aabbcc');
    expect(toHex('#abcd')).toBe('#aabbcc');
    expect(toHex('#11223344')).toBe('#112233');
    expect(toHex('rgb(255, 0, 16)')).toBe('#ff0010');
    expect(toHex('rgba(255 0 16 / 0.5)')).toBe('#ff0010');
  });

  it('gives null for what it cannot convert', () => {
    expect(toHex('4px')).toBeNull();
    expect(toHex('#abcde')).toBeNull();
  });
});
