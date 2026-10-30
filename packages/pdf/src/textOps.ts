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
import { text as pdfText, writeDict } from './objects';
import type { EmbeddedFont } from './fonts/embedFont';
import { type SegmentGlyph, type TextSegment, writeSegment } from './textSegment';

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
 * What `g` draws in `font`, or null when the face has no glyph for it. A shaped code point
 * draws its cluster's glyphs, and carries the cluster's text as `actual` wherever `/ToUnicode`
 * would read them back as anything else: more than one glyph, or a glyph first drawn for other text.
 */
function segmentGlyph(font: EmbeddedFont, g: PlacedGlyph): SegmentGlyph | null {
  if (!g.shaped) {
    const gid = font.use(g.cp);
    return gid === null ? null : { g, glyphs: [{ gid, x: 0, y: 0 }] };
  }
  const { glyphs, text } = g.shaped;
  // Only the first glyph claims the text, so a reader ignoring /ActualText reads a cluster once,
  // not once a glyph. Shapers draw a mark or pre-base matra first, ahead of a base other clusters share.
  for (const [i, { gid }] of glyphs.entries()) if (!font.useGlyph(gid, i === 0 ? text : undefined)) return null;
  return glyphs.length === 1 && font.readsAs(glyphs[0].gid) === text ? { g, glyphs } : { g, glyphs, actual: text };
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
      // A code point inside a cluster another one draws: the opening one carries its text.
      if (g.shaped?.glyphs.length === 0) continue;
      const { family, weight, style: fontStyle } = g.resolved.resolved;
      const font = await ctx.fonts.face(family, weight, fontStyle);
      const drawn = font && segmentGlyph(font, g);
      if (font && drawn) {
        if (!joins(seg, g, line)) items.push((seg = { font, line, glyphs: [] }));
        seg.glyphs.push(drawn);
        continue;
      }
      if (space) continue;
      const outline = outlineCommand(ctx, g, cmd, dx, dy);
      if (outline) items.push(outline);
      else skipGlyph(ctx, g, 'has no glyph to draw');
    }
  }

  // Consecutive text in one language other than the document's is one span marked with it.
  let open: string | undefined;
  for (const item of items) {
    if ('kind' in item) {
      await writeCommands(ctx, [item], state);
      continue;
    }
    const lang = cmd.runs[item.glyphs[0].g.run].lang;
    ctx.langs.add(lang);
    const mark = lang && lang.toLowerCase() !== ctx.opts.lang?.toLowerCase() ? lang : undefined;
    if (mark !== open) {
      if (open) ctx.out.op('EMC');
      if (mark) ctx.out.op('BDC', '/Span', writeDict({ Lang: pdfText(mark) }));
      open = mark;
    }
    await writeSegment(ctx, item, cmd, dx, dy, state);
  }
  if (open) ctx.out.op('EMC');

  const { decorations } = cachedPaintRuns(laid, cmd.runs, {});
  const rules: PathDrawCommand[] = decorations.map((d) => ({
    kind: 'path',
    path: { kind: 'rect', x: d.x0 + dx, y: d.y0 + dy, width: d.x1 - d.x0, height: d.y1 - d.y0 },
    fill: d.fill as CommandFill,
  }));
  await writeCommands(ctx, rules, state);
}
