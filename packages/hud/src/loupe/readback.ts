/**
 * Read a `rw × rh` device-pixel region of the drawing buffer centered on
 * `pointer` (CSS px relative to the canvas), returned top-down.
 *
 * GL reports rows bottom-up; every consumer here wants top-down, so both the
 * read origin and the returned rows are flipped.
 */
export function readbackRegion(
  gl: WebGL2RenderingContext,
  buffer: { width: number; height: number },
  pointer: { x: number; y: number },
  dpr: number,
  rw: number,
  rh: number,
): ImageData {
  const cx = Math.round(pointer.x * dpr);
  const cy = Math.round(pointer.y * dpr);
  const gx = clamp(cx - Math.floor(rw / 2), 0, Math.max(0, buffer.width - rw));
  const gyTop = clamp(cy - Math.floor(rh / 2), 0, Math.max(0, buffer.height - rh));
  const gy = buffer.height - gyTop - rh;

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
