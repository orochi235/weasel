import { mat3, type GlMat3 } from '@weasel-js/geom';
import type { TextDrawCommand } from './DrawCommand';
import { screenBox, strokeReachAt, type ScreenBox } from './paintedBounds';
import { laidOutText } from './textLayout';
import { glyphTurn } from '@weasel-js/text';

/**
 * How far past a glyph's advance cell its ink can reach, in ems of its own
 * size: beside it, above its baseline and below it. Margins rather than ink:
 * they cover an italic's lean (a synthetic one shears about a quarter em at the
 * ascent), a distance field's padding, a swash's overhang, and an overline or
 * underline, without reading a glyph's outline.
 */
export const TEXT_INK_EM = { side: 0.5, above: 1.5, below: 1 } as const;

/**
 * A screen-space box enclosing every pixel `cmd` can paint under `m`: each
 * laid-out glyph's advance cell grown by {@link TEXT_INK_EM}, and by how far
 * its run's outline stroke reaches, turned with the glyph. `null` for text
 * that lays out no glyph, which paints nothing.
 */
export function textBox(cmd: TextDrawCommand, m: GlMat3): ScreenBox | null {
  const { laid, dx, dy } = laidOutText(cmd);
  const scale = mat3.meanScaleOf(m), least = mat3.minScaleOf(m);
  const reach = cmd.runs.map((r) => (r.stroke ? strokeReachAt(r.stroke, scale, least) : 0));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const line of laid.lines) {
    for (const g of line.glyphs) {
      const em = g.fontSize, out = reach[g.run] ?? 0;
      // The margins about the pen, turned with the glyph.
      const l = -TEXT_INK_EM.side * em - out, r = g.advance + TEXT_INK_EM.side * em + out;
      const t = -TEXT_INK_EM.above * em - out, b = TEXT_INK_EM.below * em + out;
      const [cos, sin] = glyphTurn(g.rotate);
      for (let k = 0; k < 4; k++) {
        const cx = k === 0 || k === 3 ? l : r, cy = k < 2 ? t : b;
        const x = g.x + cx * cos - cy * sin, y = g.baselineY + cx * sin + cy * cos;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX === Infinity) return null;
  return screenBox(minX + dx, minY + dy, maxX + dx, maxY + dy, m);
}
