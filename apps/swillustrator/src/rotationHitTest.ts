/** AABB hit-test that respects a rotation around the AABB center. Inverse-
 *  rotates the world point into the unrotated frame, then does a plain
 *  axis-aligned bounds test. */
export function pointInRotatedAabb(
  wx: number,
  wy: number,
  obj: { x: number; y: number; width: number; height: number; rotation?: number },
): boolean {
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;
  const r = obj.rotation ?? 0;
  if (r === 0) {
    return wx >= obj.x && wx <= obj.x + obj.width && wy >= obj.y && wy <= obj.y + obj.height;
  }
  // Inverse-rotate the test point around the center.
  const dx = wx - cx;
  const dy = wy - cy;
  const cos = Math.cos(-r);
  const sin = Math.sin(-r);
  const lx = cx + dx * cos - dy * sin;
  const ly = cy + dx * sin + dy * cos;
  return lx >= obj.x && lx <= obj.x + obj.width && ly >= obj.y && ly <= obj.y + obj.height;
}
