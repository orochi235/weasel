import { paragraphDirection, resolveAlign, type TextDirection, type TextStyle } from '@weasel-js/core';

/**
 * The direction a text node reads in for SVG, which has no `auto`: the style's
 * own when it states one, otherwise its text's.
 */
export function svgDirection(style: TextStyle | undefined, text: string): TextDirection {
  return paragraphDirection(text, style?.direction ?? 'auto');
}

/**
 * Distance from a text box's left edge to its SVG anchor point: `x` on a
 * `<text>` is where `text-anchor` lands, which is the box's left edge, center
 * or right edge once `align` and the direction resolve to an absolute edge.
 */
export function anchorOffset(style: TextStyle | undefined, width: number, text: string): number {
  const edge = resolveAlign(style?.align ?? 'left', svgDirection(style, text));
  return edge === 'center' ? width / 2 : edge === 'right' ? width : 0;
}
