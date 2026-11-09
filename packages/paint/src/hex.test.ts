import { describe, expect, it } from 'vitest';
import { rgbaToHex } from './color';
import { byteHex, hexToRgbBytes, parseHexBytes, rgbaHex } from './hex';

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

describe('byteHex', () => {
  it('writes a channel as two digits, rounded and clamped', () => {
    expect([0, 9.6, 127.4, 255, -3, 300].map(byteHex)).toEqual(['00', '0a', '7f', 'ff', '00', 'ff']);
  });

  it('writes a NaN channel as 00, so a color written from one stays a color', () => {
    expect(byteHex(NaN)).toBe('00');
    expect(parseHexBytes(rgbaToHex([NaN, 0.5, 1, NaN]))).toEqual([0, 128, 255, 0]);
  });
});

describe('rgbaHex', () => {
  it('writes the color of any pixel with alpha, and null for a transparent one', () => {
    expect(rgbaHex([0, 10, 255, 1])).toBe('#000aff');
    expect(rgbaHex([12, 34, 56, 0])).toBeNull();
  });
});
