import { describe, expect, it } from 'vitest';
import { keepAlpha, toHex } from './color';

describe('toHex', () => {
  it('gives the six-digit hex a color input takes', () => {
    expect(toHex('#ABC')).toBe('#aabbcc');
    expect(toHex('#abcd')).toBe('#aabbcc');
    expect(toHex('#11223344')).toBe('#112233');
    expect(toHex('rgb(255, 0, 16)')).toBe('#ff0010');
    expect(toHex('rgba(255 0 16 / 0.5)')).toBe('#ff0010');
  });

  it('reads float and percent channels without a browser', () => {
    expect(toHex('rgb(254.6 0 16)')).toBe('#ff0010');
    expect(toHex('rgb(100% 0% 50%)')).toBe('#ff0080');
    expect(toHex('tomato')).toBe('#ff6347');
  });

  it('gives null for what it cannot convert', () => {
    expect(toHex('4px')).toBeNull();
    expect(toHex('#abcde')).toBeNull();
  });
});

describe('keepAlpha', () => {
  it('carries a translucent color’s alpha onto a pick, and leaves an opaque one’s pick alone', () => {
    expect(keepAlpha('#ff0000', 'rgba(230, 231, 233, 0.1)')).toBe('#ff00001a');
    expect(keepAlpha('#ff0000', '#11223380')).toBe('#ff000080');
    expect(keepAlpha('#ff0000', '#112233')).toBe('#ff0000');
    expect(keepAlpha('#ff0000', 'not a color')).toBe('#ff0000');
    for (const clear of ['transparent', '#0000', 'rgb(0 0 0 / 0)']) expect(keepAlpha('#ff0000', clear)).toBe('#ff0000');
  });
});
