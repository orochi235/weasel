/** `kit:text`'s representations by on-screen size: nothing, gray bars for its lines, then its glyphs. */
import { DEFAULT_TEXT_STYLE } from '@weasel-js/text';
import { commandFill, type DrawCommand } from '@weasel-js/renderer';
import { resolveFill, type PaintedFill } from '@weasel-js/paint';
import { nodeMemo, type InheritedPaint, type Ladder, type RectPose } from '@weasel-js/core';
import type { TextNodeData } from './textPainter';

/** Below this many device pixels of font size a text node draws nothing. */
export const TEXT_GREEK_FROM_PX = 3;
/** From this many device pixels of font size its glyphs are laid out; below, its lines are bars. */
export const TEXT_FULL_FROM_PX = 6;

const GREEK_FILL: PaintedFill = { paint: { kind: 'solid', color: 'rgba(0,0,0,1)' } };
const GREEK_ALPHA = 0.35;
const SLOT = 'shape:text-greek';

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
    const pad = Math.min(Math.max(0, d.padding ?? 0), pose.width / 2, pose.height / 2);
    const box = { x: pose.x + pad, y: pose.y + pad, width: pose.width - 2 * pad, height: pose.height - 2 * pad };
    const size = textFontSizeOf(d);
    const em = Number.isFinite(size) ? size : DEFAULT_TEXT_STYLE.fontSize;
    const pitch = em * (d.style?.lineHeight ?? DEFAULT_TEXT_STYLE.lineHeight);
    const align = d.style?.align ?? 'left';
    const fill = resolveFill(d.fill, inherited?.fill ?? null) ?? GREEK_FILL;
    const bars: DrawCommand[] = [];
    const lines = d.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const top = box.y + i * pitch + (pitch - em * 0.6) / 2;
      if (top + em * 0.6 > box.y + box.height + pitch) break;
      const chars = lines[i]!.trim().length;
      if (chars === 0) continue;
      const width = Math.min(box.width, chars * em * 0.5);
      const x = align === 'center' ? box.x + (box.width - width) / 2
        : align === 'right' || align === 'end' ? box.x + box.width - width : box.x;
      const rect = { x, y: top, width, height: em * 0.6 };
      const f = commandFill(fill, rect);
      bars.push({ kind: 'path', path: { kind: 'rect', ...rect }, ...(f ? { fill: f } : {}) });
    }
    const out: DrawCommand[] = [];
    const bg = resolveFill(d.background);
    const bgFill = bg && commandFill(bg, pose);
    if (bgFill) out.push({ kind: 'path', path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height }, fill: bgFill });
    if (bars.length > 0) out.push({ kind: 'group', alpha: GREEK_ALPHA, children: bars });
    return out;
  });
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
