import { describe, it, expect, beforeEach } from 'vitest';
import { outlineStrokeMesh, _resetOutlineStrokeMeshCacheForTests } from './outlineStrokeMeshCache';
import { registerFontOutlines, unregisterFontOutlines } from '@weasel-js/font';

const SQUARE = 'M0 0L1 0L1 -1L0 -1Z';
const LINE = 'M0 0L1 -1';

describe('outline stroke mesh cache', () => {
  beforeEach(() => {
    _resetOutlineStrokeMeshCacheForTests();
  });

  it('keys a nib, so a calligraphic outline does not reuse a round pen\'s ribbon', () => {
    const plain = outlineStrokeMesh('k|sq', SQUARE, 0.1, {});
    const nibbed = outlineStrokeMesh('k|sq', SQUARE, 0.1, { nib: { angle: 0, ratio: 0.2 } });
    expect(nibbed).not.toBe(plain);
    expect(Array.from(nibbed!.vertices)).not.toEqual(Array.from(plain!.vertices));
  });

  it('draws an inner or outer stroke on its own side of the glyph edge, as writePdf does', () => {
    const xs = (align: 'inner' | 'center' | 'outer') => {
      const v = Array.from(outlineStrokeMesh('k|sq', SQUARE, 0.1, { align })!.vertices).filter((_, i) => i % 2 === 0);
      return [Math.min(...v), Math.max(...v)].map((n) => Math.round(n * 1e4) / 1e4);
    };
    expect(xs('center')).toEqual([-0.05, 1.05]);
    expect(xs('inner')).toEqual([0, 1]);
    expect(xs('outer')).toEqual([-0.1, 1.1]);
  });

  it('drops what it holds once a face is registered again, whose glyphs the same key now names', () => {
    const line = outlineStrokeMesh('k|g', LINE, 0.1, {});
    registerFontOutlines('outline-stroke-mesh-cache-test', {}, () => new ArrayBuffer(0));
    unregisterFontOutlines('outline-stroke-mesh-cache-test');
    expect(outlineStrokeMesh('k|g', SQUARE, 0.1, {})).not.toBe(line);
  });

  it('keys a trim, so a trimmed outline does not reuse the whole ribbon', () => {
    const whole = outlineStrokeMesh('k|line', LINE, 0.1, {});
    const half = outlineStrokeMesh('k|line', LINE, 0.1, { trim: { start: 0, end: 0.5 } });
    expect(half).not.toBe(whole);
  });

  it('builds an aligned ribbon in the metric\'s space, as it does a centered one', () => {
    // P = diag(2, 1/2): a screen that stretches x four times as much as y.
    const metric = { p: 2, q: 0, r: 0.5 };
    const extent = (align: 'center' | 'outer') => {
      const v = Array.from(outlineStrokeMesh('k|sq', SQUARE, 0.1, { align }, metric)!.vertices);
      const xs = v.filter((_, i) => i % 2 === 0), ys = v.filter((_, i) => i % 2 === 1);
      return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)].map((n) => Math.round(n * 1e4) / 1e4);
    };
    expect(extent('center')).toEqual([-0.025, 1.025, -1.1, 0.1]);
    expect(extent('outer')).toEqual([-0.05, 1.05, -1.2, 0.2]);
  });
});
