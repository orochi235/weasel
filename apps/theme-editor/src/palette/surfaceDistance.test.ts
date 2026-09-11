import { describe, expect, it } from 'vitest';
import { deltaE } from './oklch';

/**
 * These colors and their CIELAB dE values come from the palette pass that set
 * the threshold. They are here to hold `CHROMA_WEIGHT` honest: a vivid color
 * has to read as further from the paper than a pale gray, and plain unweighted
 * OKLab distance gets that backwards.
 */
const PAPER = '#f5f5f6';
const REFERENCE: readonly [name: string, hex: string, cielabFromWhite: number][] = [
  ['LEGO yellow', '#fac80a', 84.9],
  ['bright yellow', '#f9f967', 70.6],
  ['light nougat', '#ffc995', 38.8],
  ['light green', '#add9a8', 35.3],
  ['maersk blue', '#abd9ff', 28.5],
  ['pale gray', '#c1c1c1', 21.9],
];

describe('distance from the surface', () => {
  it('ranks colors the way CIELAB dE does', () => {
    const byOurs = [...REFERENCE].sort((a, b) => deltaE(b[1], PAPER) - deltaE(a[1], PAPER));
    const byCielab = [...REFERENCE].sort((a, b) => b[2] - a[2]);
    expect(byOurs.map((r) => r[0])).toEqual(byCielab.map((r) => r[0]));
  });

  it('puts every real color further from paper than the gray that should be dropped', () => {
    const gray = deltaE('#c1c1c1', PAPER);
    for (const [name, hex, lab] of REFERENCE) {
      if (lab <= 21.9) continue;
      expect(deltaE(hex, PAPER), `${name} should clear the gray`).toBeGreaterThan(gray);
    }
  });

  it('is not WCAG contrast — a vivid yellow on paper is far but low-contrast', () => {
    // The whole reason this gate exists alongside the contrast one.
    expect(deltaE('#f9f967', PAPER)).toBeGreaterThan(deltaE('#c1c1c1', PAPER));
  });
});
