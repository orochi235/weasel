import { describe, it, expect } from 'vitest';
import { paintPreviewCss } from './paintPreview';
import type { FillStyle } from '@weasel-js/core';

const STOPS = [
  { offset: 0, color: '#ff0000ff' },
  { offset: 1, color: '#0000ffff' },
];

describe('paintPreviewCss', () => {
  it('gives a solid paint its own color', () => {
    expect(paintPreviewCss({ fill: 'solid', color: '#abcdef' })).toBe('#abcdef');
    expect(paintPreviewCss({ color: '#abcdef' })).toBe('#abcdef');
  });

  it('has nothing to show for absence or for a pattern', () => {
    expect(paintPreviewCss(null)).toBeUndefined();
    expect(paintPreviewCss(undefined)).toBeUndefined();
    expect(paintPreviewCss({
      fill: 'pattern', pattern: { tile: 'checker', size: 8, color: '#000' },
    } as unknown as FillStyle)).toBeUndefined();
  });

  it('reads a left-to-right gradient as CSS 90deg', () => {
    const css = paintPreviewCss({
      fill: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
      stops: STOPS, units: 'bounds',
    });
    expect(css).toMatch(/^linear-gradient\(90\.0deg, /);
  });

  it('reads a top-to-bottom gradient as CSS 180deg', () => {
    const css = paintPreviewCss({
      fill: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 0, y: 1 },
      stops: STOPS, units: 'bounds',
    });
    expect(css).toMatch(/^linear-gradient\(180\.0deg, /);
  });

  it('puts a radial gradient center where the paint has it', () => {
    const css = paintPreviewCss({
      fill: 'radial-gradient', center: { x: 0.25, y: 0.75 }, radius: 0.5,
      stops: STOPS, units: 'bounds',
    });
    expect(css).toMatch(/^radial-gradient\(circle at 25\.0% 75\.0%, /);
  });

  it('turns a conic gradient a quarter, since CSS starts at the top', () => {
    const css = paintPreviewCss({
      fill: 'conic-gradient', center: { x: 0.5, y: 0.5 }, angle: 0,
      stops: STOPS, units: 'bounds',
    });
    expect(css).toMatch(/^conic-gradient\(from 90\.0deg at 50\.0% 50\.0%, /);
  });

  it('bakes the blend space into the stops rather than leaving it to CSS', () => {
    const rgb = paintPreviewCss({
      fill: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
      stops: STOPS, units: 'bounds',
    })!;
    const lch = paintPreviewCss({
      fill: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
      stops: STOPS, units: 'bounds', interpolate: 'oklch',
    })!;
    expect(lch).not.toBe(rgb);
    // Both ends agree; the middle is where the spaces part.
    expect(lch.includes('#ff0000ff 0.0%')).toBe(rgb.includes('#ff0000ff 0.0%'));
    expect(lch).toContain('50.0%');
  });
});
