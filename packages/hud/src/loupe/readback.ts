/**
 * Read a `rw × rh` device-pixel region of the drawing buffer centered on
 * `pointer`, returned top-down. `pointer` is in CSS px relative to `target`,
 * the rect of the buffer the canvas paints into (device px, top-left origin),
 * and the read is clamped to stay inside that rect.
 *
 * GL reports rows bottom-up; every consumer here wants top-down, so both the
 * read origin and the returned rows are flipped.
 */
export function readbackRegion(
  gl: WebGL2RenderingContext,
  bufferHeight: number,
  target: { x: number; y: number; width: number; height: number },
  pointer: { x: number; y: number },
  dpr: number,
  rw: number,
  rh: number,
): ImageData {
  const cx = target.x + Math.round(pointer.x * dpr);
  const cy = target.y + Math.round(pointer.y * dpr);
  const gx = clamp(cx - Math.floor(rw / 2), target.x, target.x + Math.max(0, target.width - rw));
  const gyTop = clamp(cy - Math.floor(rh / 2), target.y, target.y + Math.max(0, target.height - rh));
  const gy = bufferHeight - gyTop - rh;

  const raw = new Uint8Array(rw * rh * 4);
  gl.readPixels(gx, gy, rw, rh, gl.RGBA, gl.UNSIGNED_BYTE, raw);

  const flipped = new Uint8ClampedArray(rw * rh * 4);
  const stride = rw * 4;
  for (let row = 0; row < rh; row++) {
    const src = (rh - 1 - row) * stride;
    flipped.set(raw.subarray(src, src + stride), row * stride);
  }
  return new ImageData(flipped, rw, rh);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
