import { cssFamilyName } from '@weasel-js/font/metrics';
import type { MeasureRowText, RowTextStyle } from './body';

/** What a row is worth when nothing measures its text, so a body laid out
 *  headlessly is not zero-height. */
export const FALLBACK_LINE = 16;

/** The advance `style.tracking` adds to `text`: one em-fraction after every
 *  character, the last included, as the text renderer spaces it. */
export function trackingWidth(text: string, style: RowTextStyle | undefined): number {
  const tracking = style?.tracking ?? 0;
  return tracking === 0 ? 0 : tracking * (style?.fontSize ?? FALLBACK_LINE) * Array.from(text).length;
}

/** The numeric weight `style` names: its `weight`, else 700 when bold. */
export const weightOf = (style: RowTextStyle | undefined): number | undefined =>
  style?.weight ?? (style?.bold === true ? 700 : undefined);

/** Adapts the kit's `measureText` for a caller holding a 2D context. Pass the
 *  same context the renderer measures with, or the floor will not match what
 *  is painted. */
export function canvasMeasure(
  ctx: { measureText(text: string): { width: number } ; font: string },
): MeasureRowText {
  return (text, style) => {
    const size = style.fontSize ?? FALLBACK_LINE;
    const weight = weightOf(style);
    ctx.font = `${style.italic === true ? 'italic ' : ''}${weight === undefined ? '' : `${weight} `}${size}px ${cssFamilyName(style.fontFamily ?? 'sans-serif')}`;
    return { width: ctx.measureText(text).width + trackingWidth(text, style), height: Math.ceil(size * 1.2) };
  };
}
