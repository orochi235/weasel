/**
 * Box vertical alignment for text draw commands. Given the command's box
 * `height` and the laid-out text block's height, returns the Y offset to
 * apply to every quad. `top` (and no box) is the legacy behavior: 0.
 */
export type TextVerticalAlign = 'top' | 'center' | 'bottom';

export function verticalAlignOffset(
  align: TextVerticalAlign | undefined,
  boxHeight: number | undefined,
  textHeight: number,
): number {
  if (align === undefined || align === 'top' || boxHeight === undefined) return 0;
  const slack = boxHeight - textHeight;
  return align === 'center' ? slack / 2 : slack;
}
