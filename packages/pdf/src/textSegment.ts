import type { Path } from '@weasel-js/geom';
import {
  type CommandPaint,
  type CommandStroke,
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
import { isSpace, outlineCommand, placedOutline, skipGlyph } from './textOutlines';

/** What one placed code point draws in a text object. */
export interface SegmentGlyph {
  g: PlacedGlyph;
  /** Each glyph and where it sits, in ems from the code point's pen, y down: one at the pen
   *  unless a shaper set its cluster. */
  glyphs: readonly { gid: number; x: number; y: number }[];
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

const FILL = 0;
const STROKE = 1;
const FILL_STROKE = 2;
const INVISIBLE = 3;
const CLIP = 7;
const JOINS = { miter: 0, round: 1 } as const;
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
 * baseline is raised with `Ts`, and a cluster `/ToUnicode` cannot give back is marked with its
 * text as `/ActualText` (`spansOf`).
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
  let rise = '0';
  const flush = () => {
    if (hex) parts.push(`<${hex}>`);
    if (parts.length > 0) out.op('TJ', `[${parts.join(' ')}]`);
    parts = [];
    hex = '';
  };
  for (const { g, glyphs, actual } of seg.glyphs) {
    for (const span of spansOf(glyphs, actual)) {
      if (span.text !== undefined) {
        flush();
        out.op('BDC', '/Span', `<</ActualText <${span.text ? `FEFF${utf16Hex(span.text)}` : ''}>>>`);
      }
      for (const { gid, x, y } of span.glyphs) {
        // Text space is y up, so a glyph the shaper moved down is a negative rise.
        const at = num(-y);
        if (at !== rise) {
          flush();
          out.op('Ts', (rise = at));
        }
        const adjust = num((pen - ((g.x - first.x) / s + x)) * 1000);
        if (adjust !== '0') {
          if (hex) parts.push(`<${hex}>`);
          hex = '';
          parts.push(adjust);
          pen -= Number(adjust) / 1000;
        }
        hex += gid.toString(16).toUpperCase().padStart(4, '0');
        pen += seg.font.widthOf(gid) / 1000;
      }
      if (span.text !== undefined) {
        flush();
        out.op('EMC');
      }
    }
  }
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
    if (outline) length = Math.max(length, dashLength(outline));
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
    if (outline) await writeCommands(ctx, [outline], state);
    else skipGlyph(ctx, g, 'has no outline to paint its ink with');
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
  const rawStroke = strokeHasInk(run.stroke) ? (run.stroke as CommandStroke & { paint: CommandPaint }) : undefined;
  const stroke = rawStroke && resolveStroke(box, rawStroke, state);
  const nativeStroke = stroke && isNative(stroke.stroke, stroke.width) && isSolidPaint(stroke.stroke.paint);
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

type Placed = SegmentGlyph['glyphs'][number];

/**
 * A code point's glyphs in the spans its text is marked with. A cluster marked with its text
 * keeps it on its glyphs on the baseline, and its glyphs off the baseline are marked with no
 * text after them: an extractor sets a span's text from its first glyph's start to its last
 * one's end, and a raised mark at either end moves the text off its line.
 */
function spansOf(glyphs: readonly Placed[], actual: string | undefined): { text?: string; glyphs: readonly Placed[] }[] {
  if (actual === undefined) return [{ glyphs }];
  const on = glyphs.filter((p) => p.y === 0);
  if (on.length === 0 || on.length === glyphs.length) return [{ text: actual, glyphs }];
  return [{ text: actual, glyphs: on }, { text: '', glyphs: glyphs.filter((p) => p.y !== 0) }];
}
