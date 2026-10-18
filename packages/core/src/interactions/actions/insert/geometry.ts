/** Resolve the effective origin mode from the binding's nominal opt
 *  and live Alt state. Alt inverts: `corner` ⇄ `center`. Applies to
 *  every shape kind — radial shapes (polygon/star) included; the
 *  overlay paints an `anchorPoint` dot at the click so corner mode
 *  reads as anchored even though no polygon vertex sits there.
 */
export function effectiveOriginMode(
  paramsOrigin: unknown,
  altHeld: boolean,
): 'corner' | 'center' {
  const nominal: 'corner' | 'center' = paramsOrigin === 'center' ? 'center' : 'corner';
  if (!altHeld) return nominal;
  return nominal === 'center' ? 'corner' : 'center';
}

/** Compute the insert AABB from drag endpoints.
 *  - `'corner'` (default): bounds = drag rect (top-left → bottom-right of cursor sweep).
 *  - `'center'`: bounds = symmetric AABB anchored on the start point.
 *    Used when the tool's Alt-modifier binding passes
 *    `originMode: 'center'` (Illustrator/Figma convention). */
export function computeBounds(
  startX: number, startY: number,
  currentX: number, currentY: number,
  originMode: 'corner' | 'center',
): { x: number; y: number; width: number; height: number } {
  if (originMode === 'center') {
    const dx = Math.abs(currentX - startX);
    const dy = Math.abs(currentY - startY);
    return { x: startX - dx, y: startY - dy, width: dx * 2, height: dy * 2 };
  }
  return {
    x: Math.min(startX, currentX),
    y: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY),
  };
}
