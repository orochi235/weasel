import type { Path } from '@weasel-js/geom';
import {
  type CommandPaint,
  type CommandStroke,
  dashPattern,
  fillHasInk,
  isSolidPaint,
  type SolidPaint,
  strokeHasInk,
} from '@weasel-js/paint';
import type { TextDrawCommand } from '@weasel-js/renderer';
import { dashLength } from '@weasel-js/stroke';
import { glyphTurn, type PlacedGlyph, SYNTHETIC_ITALIC_RADIANS, syntheticBoldOffset } from '@weasel-js/text';
import { solidColor } from './color';
import { utf16Hex } from './fonts/toUnicode';
import { type DrawState, type PageCtx, writeCommands } from './drawCommands';
import type { EmbeddedFont } from './fonts/embedFont';
import { num } from './num';
import { isNative, resolveStroke, strokeStyleOps } from './strokeOps';
import { hasOutline, isSpace, outlineCommand, placedOutline, skipNoOutline } from './textOutlines';

/** What one placed code point draws in a text object. */
export interface SegmentGlyph {
  g: PlacedGlyph;
  /** Each glyph's code in the segment's font and where it sits, in ems from the code point's
   *  pen, y down: one at the pen unless a shaper set its cluster. */
  glyphs: readonly { code: number; gid?: number; x: number; y: number }[];
  /** Text a reader takes the glyphs for, in place of what `/ToUnicode` maps them to; set when
   *  that mapping cannot give back the code point's cluster. */
  actual?: string;
}

/** Glyphs one text object draws: one line, run, face, size and baseline. */
export interface TextSegment {
  font: EmbeddedFont;
  line: number;
  glyphs: SegmentGlyph[];
}

const WHITESPACE = /^\s+$/;
const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');
const FILL = 0;
const STROKE = 1;
const FILL_STROKE = 2;
const INVISIBLE = 3;
const CLIP = 7;
const JOINS = { miter: 0, round: 1 } as const;
/** How far, in points, a glyph is raised to put it past the edge of any page. */
const OFF_PAGE = 1e6;
/** Text pdf.js moves no pen for: it sets a mark's glyph down at its base's start whatever the
 *  glyph's width. */
const PENLESS = /\p{Mn}/u;
/** `growRegion`'s default, which synthetic bold grows with; both limits are miter length over half-width. */
const BOLD_MITER_LIMIT = 4;

/**
 * A rect over every glyph's ink, for the shading and soft mask a gradient fill needs bounds for.
 * An em past each slot on every side covers any glyph the face draws, oblique ones included.
 */
function inkBox(seg: TextSegment, dx: number, dy: number): Path {
  const { fontSize: s, baselineY, rotate, x, advance } = seg.glyphs[0].g;
  if (rotate) {
    // A turned glyph is alone in its segment; this reaches past its ink at any angle.
    const r = advance + 1.5 * s;
    return { kind: 'rect', x: x + dx - r, y: baselineY + dy - r, width: 2 * r, height: 2 * r };
  }
  let x0 = Infinity;
  let x1 = -Infinity;
  for (const { g } of seg.glyphs) {
    x0 = Math.min(x0, g.x);
    x1 = Math.max(x1, g.x + g.advance);
  }
  return { kind: 'rect', x: x0 + dx - s, y: baselineY + dy - 1.5 * s, width: x1 - x0 + 2 * s, height: 2.5 * s };
}

/**
 * `BT … ET` for the segment: its glyphs at their laid-out x, the gap between what the font
 * advances and what the layout stepped written as a TJ adjustment. A glyph a shaper set off the
 * baseline is raised with `Ts`. A left-to-right cluster of several glyphs is marked with its text
 * as `/ActualText` (`spansOf`). A right-to-left one is not, since pdf.js ends a piece of text at
 * every marked span and orders right-to-left text within a piece: its glyphs that read as nothing
 * are drawn last, together, in one span that reads as nothing.
 */
function textObject(ctx: PageCtx, seg: TextSegment, mode: number, dx: number, dy: number): void {
  const { out } = ctx;
  const first = seg.glyphs[0].g;
  const s = first.fontSize;
  const shear = first.resolved.synthetic.italic ? Math.tan(SYNTHETIC_ITALIC_RADIANS) : 0;
  out.op('BT');
  out.op('Tf', `/${ctx.resources.font(seg.font.ref)}`, 1);
  if (mode !== FILL) out.op('Tr', mode);
  // Glyph space is y up and the frame is y down, so d is negative; c leans the tops toward +x.
  // A turned glyph then turns about its pen.
  const [cos, sin] = glyphTurn(first.rotate);
  out.op('Tm', cos * s, sin * s, s * (cos * shear + sin), s * (sin * shear - cos), first.x + dx, first.baselineY + dy);
  let parts: string[] = [];
  let hex = '';
  let pen = 0;
  /** Where the last `Td` put the line, in ems from the segment's start. */
  let line = 0;
  let anchor = false;
  let rise = '0';
  /** Where the last glyph pdf.js measures a gap from ended, and whether a space was drawn since. */
  let inked: number | undefined;
  let spaced = false;
  /** Right-to-left marks waiting for their base. */
  const marks: Placed[] = [];
  const flush = () => {
    if (hex) parts.push(`<${hex}>`);
    if (parts.length > 0) out.op('TJ', `[${parts.join(' ')}]`);
    parts = [];
    hex = '';
  };
  const emit = (code: number, to: number, y: number) => {
    // Text space is y up, so a glyph the shaper moved down is a negative rise.
    const at = num(-y);
    if (at !== rise) {
      flush();
      out.op('Ts', (rise = at));
    }
    if (anchor && WHITESPACE.test(seg.font.readsAs(code) ?? '')) {
      flush();
      const step = num(to - line);
      out.op('Td', step, 0);
      pen = line += Number(step);
      anchor = false;
    }
    const adjust = num((pen - to) * 1000);
    if (adjust !== '0') {
      if (hex) parts.push(`<${hex}>`);
      hex = '';
      parts.push(adjust);
      pen -= Number(adjust) / 1000;
    }
    hex += hex4(code);
    pen += seg.font.widthOf(code) / 1000;
    const reads = seg.font.readsAs(code) ?? '';
    if (WHITESPACE.test(reads)) spaced = true;
    else if (reads !== '' && !PENLESS.test(reads) && seg.font.widthOf(code) !== 0) [inked, spaced] = [pen, false];
    // pdf.js moves past no glyph that reads as nothing, and reads a gap after one as a
    // space, so its pen is put back at the next space, where a gap is read as nothing new.
    anchor ||= seg.font.readsAs(code) === '' && seg.font.widthOf(code) !== 0;
  };
  /**
   * Draws the marks waiting for the base at `base`. pdf.js takes none of their width and puts a
   * space before a mark after a space, then another for the gap to the base, so a glyph raised off
   * the page, which no reader reads, carries a kern only pdf.js skips: it brings pdf.js's pen to
   * where the base starts, or back to the end of the word before when a space came first.
   */
  const settle = (base?: number) => {
    if (marks.length === 0) return;
    const unseen = marks.reduce((w, m) => w + seg.font.widthOf(m.code), 0) / 1000;
    const back = spaced && inked !== undefined && base !== undefined ? inked - base : undefined;
    const kern = Math.round(-((back ?? 0) + unseen) * 1000);
    const { gid } = marks[0];
    const code = base !== undefined && gid !== undefined && (back !== undefined || unseen < 0) && kern !== 0 ? seg.font.useGlyph(gid, '', 0) : null;
    if (code !== null) {
      flush();
      out.op('Ts', (rise = num(OFF_PAGE / s)));
      out.op('TJ', `[${kern} <${hex4(code)}> ${-kern}]`);
    }
    for (const m of marks) emit(m.code, m.to, m.y);
    marks.length = 0;
  };
  const place = (p: Placed, rtl: boolean) => {
    if (rtl && PENLESS.test(seg.font.readsAs(p.code) ?? '')) return void marks.push(p);
    settle(p.to);
    emit(p.code, p.to, p.y);
  };
  const span = (text: string, glyphs: readonly { code: number; to: number; y: number }[]) => {
    settle();
    flush();
    out.op('BDC', '/Span', `<</ActualText <${text ? `FEFF${utf16Hex(text)}` : ''}>>>`);
    for (const p of glyphs) emit(p.code, p.to, p.y);
    flush();
    out.op('EMC');
  };
  /** Right-to-left glyphs that read as nothing, drawn after the rest. */
  const silent: Placed[] = [];
  for (const { g, glyphs, actual } of seg.glyphs) {
    const placed = glyphs.map(({ code, gid, x, y }) => ({ code, gid, to: (g.x - first.x) / s + x, y }));
    const rtl = g.shaped?.rtl ?? false;
    if (actual === undefined) {
      for (const p of placed) place(p, rtl);
    } else if (rtl) {
      for (const p of placed) {
        if (seg.font.readsAs(p.code) === '') silent.push(p);
        else place(p, rtl);
      }
    } else {
      for (const { text, glyphs: some } of spansOf(placed, actual)) span(text, some);
    }
  }
  settle();
  if (silent.length > 0) span('', silent);
  flush();
  // Ts outlives ET, as all of the text state does.
  if (rise !== '0') out.op('Ts', 0);
  out.op('ET');
}

/**
 * The longest glyph outline in the segment, for `dashPattern`'s cap. The renderer strokes each
 * glyph on its own, so this goes solid when its longest glyph would.
 */
function longestOutline(ctx: PageCtx, seg: TextSegment, dx: number, dy: number): number {
  let length = 0;
  for (const { g } of seg.glyphs) {
    const outline = isSpace(g.cp) ? null : placedOutline(ctx, g, dx, dy);
    if (outline && hasOutline(outline)) length = Math.max(length, dashLength(outline));
  }
  return length;
}

/** Paints the segment's glyphs from their outlines: all of the run's paint, or only its stroke. */
async function paintOutlines(
  ctx: PageCtx,
  seg: TextSegment,
  cmd: TextDrawCommand,
  dx: number,
  dy: number,
  state: DrawState,
  paint: 'all' | 'stroke',
): Promise<void> {
  for (const { g } of seg.glyphs) {
    if (isSpace(g.cp)) continue;
    const outline = outlineCommand(ctx, g, cmd, dx, dy, paint);
    if ('kind' in outline) await writeCommands(ctx, [outline], state);
    else skipNoOutline(ctx, g, outline, 'has no outline to paint its ink with');
  }
}

/** Selectable text that paints nothing, under ink drawn from the glyphs' outlines. */
async function writeOutlinedInk(ctx: PageCtx, seg: TextSegment, cmd: TextDrawCommand, dx: number, dy: number, state: DrawState) {
  ctx.out.op('q');
  textObject(ctx, seg, INVISIBLE, dx, dy);
  ctx.out.op('Q');
  await paintOutlines(ctx, seg, cmd, dx, dy, state, 'all');
}

/** Writes one segment as text, painted the way its run paints it. */
export async function writeSegment(
  ctx: PageCtx,
  seg: TextSegment,
  cmd: TextDrawCommand,
  dx: number,
  dy: number,
  state: DrawState,
): Promise<void> {
  const first = seg.glyphs[0].g;
  const run = cmd.runs[first.run];
  const fill = fillHasInk(run.fill) ? (run.fill!.paint as CommandPaint) : undefined;
  const box = inkBox(seg, dx, dy);
  // A glyph carries no heads, so a dash that draws no line draws nothing.
  const rawStroke = strokeHasInk(run.stroke) && dashPattern(run.stroke.dash) !== 'non-finite'
    ? (run.stroke as CommandStroke & { paint: CommandPaint }) : undefined;
  const stroke = rawStroke && resolveStroke(box, rawStroke, state);
  const nativeStroke = stroke && isNative(stroke.stroke) && isSolidPaint(stroke.stroke.paint);
  const solidFill = !fill || isSolidPaint(fill);
  const bold = syntheticBoldOffset(first.resolved);
  const fillColor = fill && isSolidPaint(fill) ? solidColor(fill, state) : undefined;
  // A text object paints a fill-and-stroke glyph twice, which only matches a grown outline when opaque.
  const boldInText = bold && !stroke && solidFill && fillColor!.alpha >= 1;
  if ((stroke && !nativeStroke) || (bold && !boldInText)) return writeOutlinedInk(ctx, seg, cmd, dx, dy, state);

  const { out } = ctx;
  if (!solidFill) {
    out.op('q');
    textObject(ctx, seg, CLIP, dx, dy);
    await writeCommands(ctx, [{ kind: 'path', path: box, fill: { paint: fill } }], state);
    out.op('Q');
    // A second text object would be extracted as a second copy of the text.
    if (stroke) await paintOutlines(ctx, seg, cmd, dx, dy, state, 'stroke');
    return;
  }
  const strokeColor = nativeStroke ? solidColor(stroke.stroke.paint as SolidPaint, state) : undefined;
  const paintsFill = fillColor;
  if (!paintsFill && !strokeColor) return;
  out.op('q');
  out.op('gs', `/${ctx.resources.extGState(paintsFill ? fillColor.alpha : 1, strokeColor?.alpha ?? fillColor?.alpha ?? 1)}`);
  if (paintsFill) out.op('rg', ...fillColor.rgb);
  if (stroke && strokeColor) {
    out.op('RG', ...strokeColor.rgb);
    const length = stroke.stroke.dash ? longestOutline(ctx, seg, dx, dy) : undefined;
    strokeStyleOps(ctx, stroke.stroke, stroke.width, length);
  } else if (bold && fillColor) {
    out.op('RG', ...fillColor.rgb);
    // The growth is per side and a stroke straddles the outline, so the line is twice it.
    out.op('w', 2 * bold.growth * first.fontSize);
    out.op('j', JOINS[bold.join]);
    out.op('M', BOLD_MITER_LIMIT);
  }
  textObject(ctx, seg, paintsFill ? (strokeColor || bold ? FILL_STROKE : FILL) : STROKE, dx, dy);
  out.op('Q');
}

type Placed = { code: number; gid?: number; to: number; y: number };

/**
 * A left-to-right cluster's glyphs in the spans its text is marked with. A cluster keeps its text
 * on its glyphs on the baseline, and its glyphs off the baseline are marked with no text after
 * them: an extractor sets a span's text from its first glyph's start to its last one's end, and
 * a raised mark at either end moves the text off its line.
 */
function spansOf(glyphs: readonly Placed[], actual: string): { text: string; glyphs: readonly Placed[] }[] {
  const on = glyphs.filter((p) => p.y === 0);
  if (on.length === 0 || on.length === glyphs.length) return [{ text: actual, glyphs }];
  return [{ text: actual, glyphs: on }, { text: '', glyphs: glyphs.filter((p) => p.y !== 0) }];
}
