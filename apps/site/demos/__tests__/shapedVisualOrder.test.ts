import { describe, expect, it } from 'vitest';
import type { ShapedGlyph } from '@weasel-js/text-shaping';
import { visualOrder } from '../shapedVisualOrder';

const g = (gid: number, cluster: number, rtl: boolean): ShapedGlyph => ({ gid, cluster, advance: 1, dx: 0, dy: 0, rtl });
const gids = (glyphs: readonly ShapedGlyph[]) => glyphs.map((x) => x.gid);

describe('visualOrder', () => {
  it('reverses right-to-left clusters but keeps the glyphs inside one in drawn order', () => {
    // Cluster 0 shapes to glyphs 1 then 2; cluster 1 to glyph 3.
    expect(gids(visualOrder([[g(1, 0, true), g(2, 0, true), g(3, 1, true)]]))).toEqual([3, 1, 2]);
  });

  it('keeps a left-to-right run inside a right-to-left line in its own order', () => {
    const shaped = [g(1, 0, true), g(2, 2, true), g(3, 4, false), g(4, 5, false)];
    expect(gids(visualOrder([shaped]))).toEqual([3, 4, 2, 1]);
  });

  it('reverses separately shaped right-to-left strings as a whole line', () => {
    expect(gids(visualOrder([[g(1, 0, true)], [g(2, 0, true)], [g(3, 0, true)]]))).toEqual([3, 2, 1]);
  });

  it('leaves a left-to-right line as it came', () => {
    expect(gids(visualOrder([[g(1, 0, false), g(2, 1, false)], [g(3, 0, false)]]))).toEqual([1, 2, 3]);
  });
});
