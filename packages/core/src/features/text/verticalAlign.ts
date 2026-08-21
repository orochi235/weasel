/**
 * Box vertical alignment for text draw commands. Given the command's box
 * `height` and the laid-out text block's height, returns the Y offset to
 * apply to every quad. `'top'` (or an undefined `align`, or a missing box
 * `height`) is the legacy behavior: offset 0.
 */
export type TextVerticalAlign = 'top' | 'center' | 'bottom';

/** How far to shift laid-out text down inside a box of `boxHeight` to satisfy
 *  a vertical alignment. Zero when the box height is unknown or alignment is
 *  top. */
export function verticalAlignOffset(
  align: TextVerticalAlign | undefined,
  boxHeight: number | undefined,
  textHeight: number,
): number {
  if (align === undefined || align === 'top' || boxHeight === undefined) return 0;
  const slack = boxHeight - textHeight;
  return align === 'center' ? slack / 2 : slack;
}
