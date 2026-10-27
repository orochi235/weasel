import { describe, it, expect } from 'vitest';
import { paintPreviewCss } from './paintPreview';
import type { Paint } from '@weasel-js/core';

const STOPS = [
  { offset: 0, color: '#ff0000ff' },
  { offset: 1, color: '#0000ffff' },
];

describe('paintPreviewCss', () => {
  it('gives a solid paint its own color', () => {
    expect(paintPreviewCss({ kind: 'solid', color: '#abcdef' })).toBe('#abcdef');
    expect(paintPreviewCss({ color: '#abcdef' })).toBe('#abcdef');
  });

  it('has nothing to show for absence or for a pattern', () => {
    expect(paintPreviewCss(null)).toBeUndefined();
    expect(paintPreviewCss(undefined)).toBeUndefined();
    expect(paintPreviewCss({
      kind: 'checker', size: 8, color: '#000',
    } as unknown as Paint)).toBeUndefined();
  });

  it('shows an image pattern\'s picture whole', () => {
    expect(paintPreviewCss({ kind: 'image', src: 'data:image/png;base64,AAAA' }))
      .toBe('url("data:image/png;base64,AAAA") center / cover no-repeat');
  });

  it('reads a left-to-right gradient as CSS 90deg', () => {
    const css = paintPreviewCss({
      kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
      stops: STOPS, units: 'bounds',
    });
    expect(css).toMatch(/^linear-gradient\(90\.0deg, /);
  });

  it('reads a top-to-bottom gradient as CSS 180deg', () => {
    const css = paintPreviewCss({
      kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 0, y: 1 },
      stops: STOPS, units: 'bounds',
    });
    expect(css).toMatch(/^linear-gradient\(180\.0deg, /);
  });

  it('puts a radial gradient center where the paint has it', () => {
    const css = paintPreviewCss({
      kind: 'radial-gradient', center: { x: 0.25, y: 0.75 }, radius: 0.5,
      stops: STOPS, units: 'bounds',
    });
    expect(css).toMatch(/^radial-gradient\(circle at 25\.0% 75\.0%, /);
  });

  it('turns a conic gradient a quarter, since CSS starts at the top', () => {
    const css = paintPreviewCss({
      kind: 'conic-gradient', center: { x: 0.5, y: 0.5 }, angle: 0,
      stops: STOPS, units: 'bounds',
    });
    expect(css).toMatch(/^conic-gradient\(from 90\.0deg at 50\.0% 50\.0%, /);
  });

  it('bakes the blend space into the stops rather than leaving it to CSS', () => {
    const rgb = paintPreviewCss({
      kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
      stops: STOPS, units: 'bounds',
    })!;
    const lch = paintPreviewCss({
      kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
      stops: STOPS, units: 'bounds', interpolate: 'oklch',
    })!;
    expect(lch).not.toBe(rgb);
    // Both ends agree; the middle is where the spaces part.
    for (const css of [lch, rgb]) {
      expect(css).toContain('#ff0000 0.0%');
      expect(css).toContain('#0000ff 100.0%');
    }
    expect(lch).toContain('50.0%');
  });
});
