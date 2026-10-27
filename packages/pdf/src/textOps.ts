import type { CommandFill } from '@weasel-js/paint';
import { fillHasInk, strokeHasInk } from '@weasel-js/paint';
import type { PathDrawCommand, TextDrawCommand } from '@weasel-js/renderer';
import {
  cachedLayoutRuns,
  cachedPaintRuns,
  type PlacedGlyph,
  resolveTextStyle,
  verticalAlignOffset,
} from '@weasel-js/text';
import { type DrawState, type PageCtx, writeCommands } from './drawCommands';
import { isSpace, outlineCommand, skipGlyph } from './textOutlines';
import { type TextSegment, writeSegment } from './textSegment';

/** Code points that hold a slot and never ink: they advance and are left out silently. */
const BLANK = /^[\s\p{Default_Ignorable_Code_Point}]$/u;

/** Whether `g` can join `seg`: one text object holds one line, run, face, size and baseline. A
 *  turned glyph turns about its own pen, so it is a text object of its own. */
function joins(seg: TextSegment | undefined, g: PlacedGlyph, line: number): seg is TextSegment {
  if (!seg || seg.line !== line || g.rotate) return false;
  const a = seg.glyphs[0].g;
  const [ra, rg] = [a.resolved, g.resolved];
  return (
    a.run === g.run &&
    a.fontSize === g.fontSize &&
    a.baselineY === g.baselineY &&
    ra.source === rg.source &&
    ra.resolved.family === rg.resolved.family &&
    ra.resolved.weight === rg.resolved.weight &&
    ra.resolved.style === rg.resolved.style &&
    ra.synthetic.bold === rg.synthetic.bold &&
    ra.synthetic.italic === rg.synthetic.italic
  );
}

/**
 * Writes a text command as PDF text in its embedded faces, laid out exactly as `drawText`
 * lays it out. A glyph whose face cannot embed is drawn as its outline; one nothing can draw
 * is reported and left out, and the glyphs after it keep their laid-out positions.
 */
export async function writeText(ctx: PageCtx, cmd: TextDrawCommand, state: DrawState): Promise<void> {
  const style = resolveTextStyle(cmd.style);
  const laid = cachedLayoutRuns(cmd.runs, {
    maxWidth: cmd.maxWidth ?? Infinity,
    alignWidth: cmd.width,
    lineHeight: style.lineHeight,
    align: cmd.align ?? style.align,
    direction: cmd.direction ?? style.direction,
    tabSize: style.tabSize,
    justify: cmd.justify,
  });
  const dx = cmd.x;
  const dy = cmd.y + verticalAlignOffset(cmd.verticalAlign, cmd.height, laid.bounds.height);

  const items: (TextSegment | PathDrawCommand)[] = [];
  let seg: TextSegment | undefined;
  for (const [line, box] of laid.lines.entries()) {
    for (const g of box.glyphs) {
      const run = cmd.runs[g.run];
      if (!fillHasInk(run.fill) && !strokeHasInk(run.stroke)) continue;
      const space = isSpace(g.cp);
      if (!space && BLANK.test(String.fromCodePoint(g.cp))) continue;
      // A slot the layout left empty has no width, so drawing into it would land on its neighbor.
      if (!space && (g.glyph?.color || (g.resolved.source !== 'outline' && g.glyph === null))) {
        skipGlyph(ctx, g, 'has no glyph to draw');
        continue;
      }
      const { family, weight, style: fontStyle } = g.resolved.resolved;
      const font = await ctx.fonts.face(family, weight, fontStyle);
      const gid = font?.use(g.cp) ?? null;
      if (font && gid !== null) {
        if (!joins(seg, g, line)) items.push((seg = { font, line, glyphs: [] }));
        seg.glyphs.push({ g, gid });
        continue;
      }
      if (space) continue;
      const outline = outlineCommand(ctx, g, cmd, dx, dy);
      if (outline) items.push(outline);
      else skipGlyph(ctx, g, 'has no glyph to draw');
    }
  }

  for (const item of items) {
    if ('kind' in item) await writeCommands(ctx, [item], state);
    else await writeSegment(ctx, item, cmd, dx, dy, state);
  }

  const { decorations } = cachedPaintRuns(laid, cmd.runs, {});
  const rules: PathDrawCommand[] = decorations.map((d) => ({
    kind: 'path',
    path: { kind: 'rect', x: d.x0 + dx, y: d.y0 + dy, width: d.x1 - d.x0, height: d.y1 - d.y0 },
    fill: d.fill as CommandFill,
  }));
  await writeCommands(ctx, rules, state);
}
