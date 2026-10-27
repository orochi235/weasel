/**
 * A turned run's outlines turn each glyph about its own pen on the baseline,
 * clockwise with y down, as SVG's `rotate` does.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { registerFontOutlines, loadFontOutlines, type OutlineFace } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { layoutTextPose, type TextPose } from '@weasel-js/text';
import { boundsOfPath, pointInPath } from '@weasel-js/geom';
import { textToPath, type TextOutlineSource } from './textToPath';

/** A half-em square sitting on the baseline at the pen, for every letter. */
const SQUARES: OutlineFace = {
  unitsPerEm: 1000,
  ascender: 0.8,
  advanceOf: () => 0.6,
  kernOf: () => 0,
  glyphD: (cp) => (cp >= 65 && cp <= 90 ? 'M0 -0.5L0.5 -0.5L0.5 0L0 0Z' : null),
};

const POSE = { x: 10, y: 20, width: 600, height: 200 };
const INK = { paint: { kind: 'solid', color: '#000' } } as const;
const STYLE = { fontFamily: 'squares', fontSize: 100 };

const source = (runs: TextOutlineSource['runs']): TextOutlineSource => ({
  text: runs!.map((r) => r.text).join(''), runs, style: STYLE, fill: INK,
});

/** Where the first glyph's pen sits in world space. */
function pen(src: TextOutlineSource): { x: number; y: number } {
  const tp: TextPose = { ...POSE, text: src.text, runs: src.runs as TextPose['runs'], style: src.style, fill: INK };
  const { laid, x, y } = layoutTextPose(tp);
  const g = laid.lines[0].glyphs[0];
  return { x: x + g.x, y: y + g.baselineY };
}

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
  registerFontOutlines('squares', {}, new ArrayBuffer(4), { parser: () => SQUARES });
  await loadFontOutlines('squares');
});

describe('textToPath of turned glyphs', () => {
  it('turns a glyph clockwise about its pen: a quarter turn takes it below the baseline', () => {
    const src = source([{ text: 'A', rotate: 90 }]);
    const p = pen(src);
    const b = boundsOfPath(textToPath(src, POSE));
    expect(b.x).toBeCloseTo(p.x, 3);
    expect(b.y).toBeCloseTo(p.y, 3);
    expect(b.width).toBeCloseTo(50, 3);
    expect(b.height).toBeCloseTo(50, 3);
  });

  it('turns each glyph about its own pen and leaves the next run upright', () => {
    const src = source([{ text: 'AA', rotate: 180 }, { text: 'A' }]);
    const p = pen(src);
    const path = textToPath(src, POSE);
    // A half turn hangs each square below the baseline, to the left of its pen.
    expect(pointInPath(path, p.x - 25, p.y + 25)).toBe(true);
    expect(pointInPath(path, p.x + 60 - 25, p.y + 25)).toBe(true);
    expect(pointInPath(path, p.x + 25, p.y - 25)).toBe(false);
    // The third glyph, upright, sits where it would have.
    expect(pointInPath(path, p.x + 120 + 25, p.y - 25)).toBe(true);
    expect(pointInPath(path, p.x + 120 + 25, p.y + 25)).toBe(false);
  });
});
