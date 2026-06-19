import { describe, it, expect } from 'vitest';
import { oklchToHex, chromaAt, type ChromaCurve } from './oklch';

describe('oklchToHex', () => {
  it('L=1, C=0 is white', () => {
    expect(oklchToHex(1, 0, 0)).toBe('#ffffff');
  });

  it('L=0, C=0 is black', () => {
    expect(oklchToHex(0, 0, 0)).toBe('#000000');
  });

  it('L=0.5, C=0 is a neutral gray', () => {
    const hex = oklchToHex(0.5, 0, 0);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(r).toBeGreaterThan(80);
    expect(r).toBeLessThan(140);
  });

  it('returns a 7-char #rrggbb string', () => {
    const hex = oklchToHex(0.7, 0.15, 30);
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('clamps out-of-gamut values to byte range', () => {
    const hex = oklchToHex(0.7, 0.5, 30);
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('matches known in-gamut L/C/H → hex values', () => {
    // Pinned outputs from the pre-dedup implementation; the kit pipeline
    // must stay numerically equivalent for in-gamut inputs.
    expect(oklchToHex(0.7, 0.15, 30)).toBe('#ed7665');
    expect(oklchToHex(0.6, 0.1, 150)).toBe('#519160');
    expect(oklchToHex(0.5, 0.08, 260)).toBe('#486491');
  });
});

describe('chromaAt', () => {
  const curve: ChromaCurve = {
    lRange: [0.2, 0.95],
    midL: 0.6,
    cBot: 0.05,
    cPeak: 0.18,
    cTop: 0.04,
  };

  it('returns cBot at and below lRange[0]', () => {
    expect(chromaAt(0.1, curve)).toBe(0.05);
    expect(chromaAt(0.2, curve)).toBe(0.05);
  });

  it('returns cTop at and above lRange[1]', () => {
    expect(chromaAt(0.95, curve)).toBe(0.04);
    expect(chromaAt(1.0, curve)).toBe(0.04);
  });

  it('returns cPeak at midL', () => {
    expect(chromaAt(0.6, curve)).toBeCloseTo(0.18, 10);
  });

  it('linearly interpolates on the lower segment', () => {
    const L = (0.2 + 0.6) / 2;
    expect(chromaAt(L, curve)).toBeCloseTo((0.05 + 0.18) / 2, 10);
  });

  it('linearly interpolates on the upper segment', () => {
    const L = (0.6 + 0.95) / 2;
    expect(chromaAt(L, curve)).toBeCloseTo((0.18 + 0.04) / 2, 10);
  });
});
