import { describe, it, expect } from 'vitest';
import { GLYPH_CELL_VERT_GLSL, GLYPH_CORNER_POST } from './glyphCell';
import { BATCH_AREA_VERT_SRC, BATCH_VERT_SRC } from './batchFill';
import { GLYPH_PAINT_VERT_SRC } from './glyphPaint';

/** `glyphCellOf`, run as JavaScript. */
const glyphCellOf = new Function('post', GLYPH_CELL_VERT_GLSL
  .replace(/^\s*vec3 glyphCellOf\(float post\) \{/, '')
  .replace(/}\s*$/, '')
  .replace('float corner', 'const corner')
  .replace(/floor\(/g, 'Math.floor(')
  .replace(/mod\(([^,]+), 2\.0\)/, '(($1) % 2)')
  .replace(/vec3\(/, '[')
  .replace(/\);\s*$/, '];')) as (post: number) => number[];

describe('glyph cell corners', () => {
  it('reads each corner and the bold shift back out of a_post', () => {
    const cell = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (const bold of [0, 0.08, 0.999]) {
      GLYPH_CORNER_POST.forEach((k, i) => {
        const [x, y, b] = glyphCellOf(bold + k);
        expect([x, y]).toEqual(cell[i]);
        expect(b).toBeCloseTo(bold, 6);
      });
    }
  });

  it('decodes only a glyph vertex, and only in the area build', () => {
    expect(BATCH_VERT_SRC).not.toContain('glyphCellOf');
    expect(BATCH_AREA_VERT_SRC).toMatch(/glyph \? glyphCellOf\(a_post\) : vec3\(0\.0, 0\.0, a_post\)/);
  });

  it('gives the painted-glyph program the cell too', () => {
    expect(GLYPH_PAINT_VERT_SRC).toContain('v_cell = glyphCellOf(a_post).xy;');
  });
});
