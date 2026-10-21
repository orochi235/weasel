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
import { type PlacedGlyph, SYNTHETIC_ITALIC_RADIANS, syntheticBoldOffset } from '@weasel-js/text';
import { solidColor } from './color';
import { type DrawState, type PageCtx, writeCommands } from './drawCommands';
import type { EmbeddedFont } from './fonts/embedFont';
import { num } from './num';
import { isNative, resolveStroke, strokeStyleOps } from './strokeOps';
import { isSpace, outlineCommand, placedOutline, skipGlyph } from './textOutlines';

/** Glyphs one text object draws: one line, run, face, size and baseline. */
export interface TextSegment {
  font: EmbeddedFont;
  line: number;
  glyphs: { g: PlacedGlyph; gid: number }[];
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
  const { fontSize: s, baselineY } = seg.glyphs[0].g;
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
 * advances and what the layout stepped written as a TJ adjustment.
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
  out.op('Tm', s, 0, s * shear, -s, first.x + dx, first.baselineY + dy);
  const parts: string[] = [];
  let hex = '';
  let pen = 0;
  for (const { g, gid } of seg.glyphs) {
    const adjust = num((pen - (g.x - first.x) / s) * 1000);
    if (adjust !== '0') {
      if (hex) parts.push(`<${hex}>`);
      hex = '';
      parts.push(adjust);
      pen -= Number(adjust) / 1000;
    }
    hex += gid.toString(16).toUpperCase().padStart(4, '0');
    pen += seg.font.widthOf(gid) / 1000;
  }
  parts.push(`<${hex}>`);
  out.op('TJ', `[${parts.join(' ')}]`);
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
