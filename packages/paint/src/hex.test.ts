import { describe, expect, it } from 'vitest';
import { hexToRgbBytes, parseHexBytes } from './hex';

describe('parseHexBytes', () => {
  it('reads six and eight digits', () => {
    expect(parseHexBytes('#ff8000')).toEqual([255, 128, 0, 255]);
    expect(parseHexBytes('#FF800040')).toEqual([255, 128, 0, 64]);
  });

  it('doubles each digit of the three and four digit forms', () => {
    expect(parseHexBytes('#abc')).toEqual([0xaa, 0xbb, 0xcc, 255]);
    expect(parseHexBytes('#abcd')).toEqual([0xaa, 0xbb, 0xcc, 0xdd]);
  });

  it('is null for anything else', () => {
    for (const bad of ['', '#', '#ab', '#abcde', '#abcdefa', '#gg0000', 'abc', 'red', ' #abc', '#abcdef012']) {
      expect(parseHexBytes(bad), bad).toBeNull();
    }
  });
});

describe('hexToRgbBytes', () => {
  it('drops the alpha', () => {
    expect(hexToRgbBytes('#11223344')).toEqual([0x11, 0x22, 0x33]);
  });

  it('throws on what is not a hex color, naming it', () => {
    expect(() => hexToRgbBytes('tomato')).toThrow(/"tomato"/);
  });
});
