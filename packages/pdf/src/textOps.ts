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
 * draws its cluster's glyphs, one reading back as the cluster's text and the rest as nothing;
 * a cluster of more than one glyph carries its text as `actual` too.
 */
function segmentGlyph(font: EmbeddedFont, g: PlacedGlyph): SegmentGlyph | null {
  if (!g.shaped) {
    const code = font.use(g.cp);
    return code === null ? null : { g, glyphs: [{ code, x: 0, y: 0 }] };
  }
  const { glyphs, text } = g.shaped;
  const placed: SegmentGlyph['glyphs'][number][] = [];
  const claim = widest(font, glyphs);
  for (const [i, { gid, x, y, advance }] of glyphs.entries()) {
    const reads = i === claim ? text : '';
    const code = font.useGlyph(gid, reads, advance === 0 ? markWidth(reads, x) : undefined);
    if (code === null) return null;
    placed.push({ code, x, y });
  }
  return placed.length === 1 ? { g, glyphs: placed } : { g, glyphs: placed, actual: text };
}

/**
 * How far a glyph the shaper gave no advance moves the pen, in 1000/em: nowhere when it reads
 * as nothing, and otherwise to its cluster's pen when it sits before it, so a reader that boxes
 * each character by its advance (poppler) finds no gap between a mark and the base after it.
 */
function markWidth(reads: string, x: number): number {
  return reads === '' ? 0 : Math.max(0, Math.round(-x * 1000));
}

/**
 * The glyph a cluster's text goes on: its widest, the first of those as wide. A reader that
 * ignores `/ActualText` (pdf.js) moves past no glyph that reads as nothing, so the text belongs
 * on the base, and the marks and matras around it read as nothing.
 */
function widest(font: EmbeddedFont, glyphs: readonly { gid: number }[]): number {
  let best = 0;
  for (let i = 1; i < glyphs.length; i++) if (font.glyphWidth(glyphs[i].gid) > font.glyphWidth(glyphs[best].gid)) best = i;
  return best;
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
