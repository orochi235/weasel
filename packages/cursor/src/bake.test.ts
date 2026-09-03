import { describe, expect, it } from 'vitest';
import { bakeCursor } from './bake';
import type { CursorGlyph } from './types';

const PENCIL: CursorGlyph = {
  box: 24,
  hotspot: [5, 19],
  paths: [
    { role: 'ink', d: 'M 5 19 L 7.5 16.5 L 16 8 L 19 11 L 10.5 19.5 L 8 19 Z' },
    { role: 'detail', d: 'M 14 6 L 19 11', width: 1.2 },
  ],
};

describe('bakeCursor', () => {
  it('scales the hotspot from glyph units to integer CSS px', () => {
    // box 24, hotspot (5,19), size 24 -> unchanged.
    expect(bakeCursor(PENCIL, { size: 24 })).toContain('") 5 19,');
    // Same glyph at 48 -> doubled.
    expect(bakeCursor(PENCIL, { size: 48 })).toContain('") 10 38,');
  });

  it('rounds a fractional hotspot rather than emitting a decimal', () => {
    // 5/24*30 = 6.25 -> 6;  19/24*30 = 23.75 -> 24.
    expect(bakeCursor(PENCIL, { size: 30 })).toContain('") 6 24,');
  });

  it('always ends in a keyword fallback', () => {
    // Without one, a rejected image leaves the element on `auto`, not on the
    // cursor the tool asked for.
    expect(bakeCursor(PENCIL, {})).toMatch(/, default$/);
    expect(bakeCursor(PENCIL, { fallback: 'crosshair' })).toMatch(/, crosshair$/);
  });

  it('percent-encodes the payload so no raw # reaches the URI', () => {
    // An unencoded '#' from a color starts a fragment and truncates the SVG.
    const css = bakeCursor(PENCIL, {});
    const uri = css.slice(css.indexOf('data:'), css.indexOf('")'));
    expect(uri).not.toContain('#');
    expect(decodeURIComponent(uri)).toContain('#141418');
  });

  it('draws every halo before any ink', () => {
    // Not cosmetic: with each path stroking its own halo, a later path's halo
    // cuts a white trench through an earlier path's fill where they overlap.
    const svg = decodeURIComponent(bakeCursor(PENCIL, {}));
    const lastHalo = svg.lastIndexOf(`stroke="#ffffff" stroke-width="2.6"`);
    const firstInk = svg.indexOf(`fill="#141418"`);
    expect(lastHalo).toBeGreaterThan(-1);
    expect(firstInk).toBeGreaterThan(lastHalo);
  });

  it('widens a stroke member by the halo width in the halo pass', () => {
    const handled: CursorGlyph = {
      box: 24,
      hotspot: [12, 12],
      paths: [{ role: 'stroke', d: 'M 6 6 L 18 18', width: 1.6 }],
    };
    const svg = decodeURIComponent(bakeCursor(handled, {}));
    // 1.6 of ink needs 1.6 + 2.6 of halo to keep 1.3 proud on either side.
    expect(svg).toContain('stroke-width="4.2"');
    expect(svg).toContain(`stroke="#141418" stroke-width="1.6"`);
  });

  it('declares the requested size on the svg element', () => {
    const svg = decodeURIComponent(bakeCursor(PENCIL, { size: 32 }));
    // For a cursor image, 1 image px == 1 CSS px, so the declared width IS the
    // rendered size. Nothing else controls it.
    expect(svg).toContain('width="32"');
    expect(svg).toContain('viewBox="0 0 24 24"');
  });

  it('throws above the measured Chrome cap instead of emitting a dud', () => {
    // Chrome drops the image silently at this size; a loud failure here is the
    // whole reason the painted tier exists.
    expect(() => bakeCursor(PENCIL, { size: 160 })).toThrow(/128/);
  });
});
