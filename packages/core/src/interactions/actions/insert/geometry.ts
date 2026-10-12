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

/** Constrain `end` to the nearest 15° increment around `start`, preserving
 *  the drag length. The line tool's documented Shift behavior. */
export function snapTo15Degrees(
  start: { x: number; y: number },
  end: { x: number; y: number },
): { x: number; y: number } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return end;
  const step = Math.PI / 12; // 15°
  const snapped = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: start.x + len * Math.cos(snapped), y: start.y + len * Math.sin(snapped) };
}
