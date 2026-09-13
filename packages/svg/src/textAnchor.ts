import { resolveAlign, type TextStyle } from '@weasel-js/core';

/**
 * Distance from a text box's left edge to its SVG anchor point: `x` on a
 * `<text>` is where `text-anchor` lands, which is the box's left edge, center
 * or right edge once `align` and `direction` resolve to an absolute edge.
 */
export function anchorOffset(style: TextStyle | undefined, width: number): number {
  const edge = resolveAlign(style?.align ?? 'left', style?.direction ?? 'ltr');
  return edge === 'center' ? width / 2 : edge === 'right' ? width : 0;
}
