import { describe, expect, it } from 'vitest';
import { ditherPixels } from './ditherPixels';
import { grayImage } from './testing/grayImage';

const ramp = () => grayImage(8, 4, (x) => x * 32 + 16);
const rows = (m: Uint8Array, w: number) =>
  Array.from({ length: m.length / w }, (_, y) => Array.from(m.slice(y * w, y * w + w)).join(''));
const inkShare = (m: Uint8Array) => m.reduce((n, v) => n + v, 0) / m.length;

// Rows match obwat's ditherToMask on the same 8×4 ramp (gray = x * 32 + 16).
const RAMP_ROWS = {
  'floyd-steinberg': ['11101000', '11010010', '11101000', '11010100'],
  atkinson: ['11100000', '11111000', '11001000', '11100000'],
} as const;

describe.each(['floyd-steinberg', 'atkinson'] as const)('ditherPixels: %s', (method) => {
  it('turns a flat mid gray into a pattern, where threshold gives none', () => {
    const image = grayImage(32, 32, () => 128);
    expect(inkShare(ditherPixels(image))).toBe(0);
    const share = inkShare(ditherPixels(image, { method }));
    expect(share).toBeGreaterThan(0.35);
    expect(share).toBeLessThan(0.65);
  });

  it('matches a reference ditherer on a ramp', () => {
    expect(rows(ditherPixels(ramp(), { method }), 8)).toEqual(RAMP_ROWS[method]);
  });

  it('keeps protected pixels at plain threshold', () => {
    const image = grayImage(16, 16, () => 140);
    const protect = new Uint8Array(16 * 16);
    for (let y = 0; y < 16; y++) protect.fill(1, y * 16 + 8, y * 16 + 16);
    const m = ditherPixels(image, { method, protect });
    for (let y = 0; y < 16; y++) {
      expect(Array.from(m.slice(y * 16 + 8, y * 16 + 16))).toEqual(new Array(8).fill(0));
    }
    expect(inkShare(m)).toBeGreaterThan(0);
  });

  it('lets no error in or out of a protected region', () => {
    // The left half beside a protected right half dithers exactly as the left
    // half alone, whose error past its right edge is dropped.
    const image = grayImage(16, 8, (x) => (x < 8 ? 140 : 60));
    const protect = new Uint8Array(16 * 8);
    for (let y = 0; y < 8; y++) protect.fill(1, y * 16 + 8, y * 16 + 16);
    const full = ditherPixels(image, { method, protect });
    const alone = ditherPixels(grayImage(8, 8, () => 140), { method });
    for (let y = 0; y < 8; y++) {
      expect(Array.from(full.slice(y * 16, y * 16 + 8))).toEqual(Array.from(alone.slice(y * 8, y * 8 + 8)));
    }
  });

  it('lets no error into a protected region', () => {
    const image = grayImage(16, 8, (x) => (x < 8 ? 60 : 120));
    const protect = new Uint8Array(16 * 8);
    for (let y = 0; y < 8; y++) protect.fill(1, y * 16 + 8, y * 16 + 16);
    const full = ditherPixels(image, { method, protect });
    for (let y = 0; y < 8; y++) {
      expect(Array.from(full.slice(y * 16 + 8, y * 16 + 16))).toEqual(new Array(8).fill(1));
    }
  });
});
