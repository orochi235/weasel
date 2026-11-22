/** `kit:text`'s representations by on-screen size: nothing, gray bars for its lines, then its glyphs. */
import { DEFAULT_TEXT_STYLE, verticalAlignOffset } from '@weasel-js/text';
import type { Rect } from '@weasel-js/geom';
import { commandFill, type DrawCommand } from '@weasel-js/renderer';
import { resolveFill, type PaintedFill } from '@weasel-js/paint';
import { nodeMemo, type InheritedPaint, type Ladder, type RectPose } from '@weasel-js/core';
import type { TextNodeData } from './textPainter';
import { textBackdropOf, textBoxOf } from './textFrame';

/** Below this many device pixels of font size a text node draws nothing. */
export const TEXT_GREEK_FROM_PX = 3;
/** From this many device pixels of font size its glyphs are laid out; below, its lines are bars. */
export const TEXT_FULL_FROM_PX = 6;

const GREEK_FILL: PaintedFill = { paint: { kind: 'solid', color: 'rgba(0,0,0,1)' } };
const GREEK_ALPHA = 0.35;
const SLOT = 'shape:text-greek';
/** A bar's height and a character's width, as fractions of the font size. */
const BAR_HEIGHT = 0.6;
const CHAR_WIDTH = 0.5;

/** The scale, at most 1, at which `lines` set as bars fit `box`: by height, and by width too when they do not wrap. */
function shrinkOf(lines: readonly string[], em: number, lineHeight: number, box: Rect, wrap: boolean): number {
  let k = Math.min(1, box.height / (lines.length * em * lineHeight));
  if (!wrap) {
    let widest = 0;
    for (const line of lines) widest = Math.max(widest, line.trim().length);
    if (widest > 0) k = Math.min(k, box.width / (widest * em * CHAR_WIDTH));
  }
  return Math.max(0, k);
}

/** The font size `d` is set at in world units, or `Infinity` for one sized in screen pixels,
 *  which is the same on screen at every zoom. */
export function textFontSizeOf(d: Pick<TextNodeData, 'style'>): number {
  const size = d.style?.fontSize ?? DEFAULT_TEXT_STYLE.fontSize;
  return typeof size === 'number' ? size : Infinity;
}

/** One bar per source line, as wide as its characters would roughly set, at the line pitch. No
 *  glyph is laid out: the bars stand in for text too small to read. */
export function paintGreekText(node: { data?: unknown }, pose: RectPose, inherited?: InheritedPaint): DrawCommand[] {
  const d = node.data as TextNodeData;
  return nodeMemo(node, SLOT, pose, (): DrawCommand[] => {
    const box = textBoxOf(d, pose);
    const size = textFontSizeOf(d);
    const lines = d.text.split('\n');
    let em = Number.isFinite(size) ? size : DEFAULT_TEXT_STYLE.fontSize;
    const lineHeight = d.style?.lineHeight ?? DEFAULT_TEXT_STYLE.lineHeight;
    if (d.fit === 'shrink') em *= shrinkOf(lines, em, lineHeight, box, d.style?.wrap ?? DEFAULT_TEXT_STYLE.wrap);
    const pitch = em * lineHeight;
    const barHeight = em * BAR_HEIGHT;
    const align = d.style?.align ?? 'left';
    const fill = resolveFill(d.fill, inherited?.fill ?? null) ?? GREEK_FILL;
    const clip = d.overflow === 'clip';
    const y0 = box.y + verticalAlignOffset(d.verticalAlign, box.height, lines.length * pitch);
    const bars: DrawCommand[] = [];
    for (let i = 0; i < lines.length; i++) {
      const top = y0 + i * pitch + (pitch - barHeight) / 2;
      if (clip && top + barHeight <= pose.y) continue;
      if (clip && top >= pose.y + pose.height) break;
      const chars = lines[i]!.trim().length;
      if (chars === 0) continue;
      const width = Math.min(box.width, chars * em * CHAR_WIDTH);
      const x = align === 'center' ? box.x + (box.width - width) / 2
        : align === 'right' || align === 'end' ? box.x + box.width - width : box.x;
      const y = clip ? Math.max(top, pose.y) : top;
      const bottom = clip ? Math.min(top + barHeight, pose.y + pose.height) : top + barHeight;
      const rect = { x, y, width, height: bottom - y };
      const f = commandFill(fill, rect);
      bars.push({ kind: 'path', path: { kind: 'rect', ...rect }, ...(f ? { fill: f } : {}) });
    }
    const out = textBackdropOf(d, pose);
    if (bars.length > 0) out.push({ kind: 'group', alpha: GREEK_ALPHA, children: bars });
    return out;
  }, inherited);
}

/** `kit:text`'s ladder: `none` below 3 px of font size, `greek` bars to 6 px, glyphs from there. */
export const TEXT_LADDER: Ladder<unknown, RectPose> = {
  rungs: [
    { id: 'none', fromPx: 0, children: 'skip' },
    { id: 'greek', fromPx: TEXT_GREEK_FROM_PX, paint: (node, pose, ctx) => paintGreekText(node, pose, ctx?.inherited) },
    { id: 'full', fromPx: TEXT_FULL_FROM_PX },
  ],
  sizeOf: (node) => textFontSizeOf(node.data as TextNodeData),
};
