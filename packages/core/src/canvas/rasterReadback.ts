/** A GL readback (bottom-up, premultiplied RGBA) as image bytes: top-down
 *  rows of straight RGBA. */
export function straightTopDown(raw: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const data = flipRows(raw, width, height);
  unpremultiply(data);
  return data;
}

/** Flip GL's bottom-up readback rows into top-down image order. */
function flipRows(raw: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const rowBytes = width * 4;
  const out = new Uint8ClampedArray(raw.length);
  for (let y = 0; y < height; y++) {
    out.set(raw.subarray((height - 1 - y) * rowBytes, (height - y) * rowBytes), y * rowBytes);
  }
  return out;
}

/** Convert premultiplied RGBA to straight RGBA in place. */
function unpremultiply(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0 || a === 255) continue;
    const inv = 255 / a;
    data[i] = data[i] * inv;
    data[i + 1] = data[i + 1] * inv;
    data[i + 2] = data[i + 2] * inv;
  }
}
