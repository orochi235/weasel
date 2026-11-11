import { cssFamilyName } from '@weasel-js/font/metrics';
import type { MeasureRowText, RowTextStyle } from './body';

/** What a row is worth when nothing measures its text, so a body laid out
 *  headlessly is not zero-height. */
export const FALLBACK_LINE = 16;

/** The line height a row's scene text is set at: the text style's default, which a row leaves. */
const TEXT_LINE_HEIGHT = 1.2;

/** Advance width per character, in font sizes, where nothing measures text. */
export const GLYPH = 0.6;

/** `text`'s width where nothing measures it: {@link GLYPH} font sizes a code point, and its tracking. `style.fontSize`
 *  unset counts as {@link FALLBACK_LINE}. */
export function estimatedWidth(text: string, style: RowTextStyle | undefined): number {
  return Array.from(text).length * (style?.fontSize ?? FALLBACK_LINE) * GLYPH + trackingWidth(text, style);
}

/** The advance `style.tracking` adds to `text`: one em-fraction after every
 *  character, the last included, as the text renderer spaces it. */
export function trackingWidth(text: string, style: RowTextStyle | undefined): number {
  const tracking = style?.tracking ?? 0;
  return tracking === 0 ? 0 : tracking * (style?.fontSize ?? FALLBACK_LINE) * Array.from(text).length;
}

/** The numeric weight `style` names: its `weight`, else 700 when bold. */
export const weightOf = (style: RowTextStyle | undefined): number | undefined =>
  style?.weight ?? (style?.bold === true ? 700 : undefined);

/** A face's vertical metrics, in ems: baseline to the top and to the bottom of its line box, and its cap height. */
export interface CapMetrics { ascent: number; descent: number; capHeight: number }

/**
 * How far below the top of a `size` text line box the midpoint between the baseline and the cap
 * height falls. The baseline is placed as the text renderer places it: the ascent plus half the
 * leading the line height leaves around ascent and descent.
 */
export function capCenterFrom(m: CapMetrics, size: number): number {
  const baseline = (size * TEXT_LINE_HEIGHT - (m.ascent + m.descent) * size) / 2 + m.ascent * size;
  return baseline - (m.capHeight * size) / 2;
}

type CanvasMetrics = { width: number; fontBoundingBoxAscent?: number; fontBoundingBoxDescent?: number; actualBoundingBoxAscent?: number };

/** Adapts the kit's `measureText` for a caller holding a 2D context. Pass the
 *  same context the renderer measures with, or the floor will not match what
 *  is painted. Where the context reports font and glyph bounds, it also
 *  reports `capCenter`, from a capital H. */
export function canvasMeasure(
  ctx: { measureText(text: string): CanvasMetrics; font: string },
): MeasureRowText {
  return (text, style) => {
    const size = style.fontSize ?? FALLBACK_LINE;
    const weight = weightOf(style);
    ctx.font = `${style.italic === true ? 'italic ' : ''}${weight === undefined ? '' : `${weight} `}${size}px ${cssFamilyName(style.fontFamily ?? 'sans-serif')}`;
    const out = { width: ctx.measureText(text).width + trackingWidth(text, style), height: Math.ceil(size * TEXT_LINE_HEIGHT) };
    const h = ctx.measureText('H');
    if (h.fontBoundingBoxAscent === undefined || h.fontBoundingBoxDescent === undefined || h.actualBoundingBoxAscent === undefined) return out;
    const em = (v: number) => (size === 0 ? 0 : v / size);
    return { ...out, capCenter: capCenterFrom({ ascent: em(h.fontBoundingBoxAscent), descent: em(h.fontBoundingBoxDescent), capHeight: em(h.actualBoundingBoxAscent) }, size) };
  };
}
