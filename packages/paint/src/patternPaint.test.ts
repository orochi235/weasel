import { describe, it, expect } from 'vitest';
import { isImagePatternPaint, isPatternPaint, isTilePaint, patternPlacementOf, type ImagePatternPaint } from './patternPaint';

const IMAGE: ImagePatternPaint = { kind: 'image', src: 'data:image/png;base64,AAAA', width: 20, height: 10, units: 'bounds' };

describe('image pattern paints', () => {
  it('count as a pattern, and not as a built-in tile', () => {
    expect(isPatternPaint(IMAGE)).toBe(true);
    expect(isImagePatternPaint(IMAGE)).toBe(true);
    expect(isTilePaint(IMAGE)).toBe(false);
  });

  it('leave every other paint out', () => {
    expect(isImagePatternPaint({ kind: 'hatch', color: '#000' })).toBe(false);
    expect(isImagePatternPaint({ color: '#000' })).toBe(false);
  });

  it('keep their extent out of the placement', () => {
    expect(patternPlacementOf(IMAGE)).toEqual({ units: 'bounds' });
  });
});
