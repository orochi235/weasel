/** The bytes of `data` a write sends: `srcOffset` and `length` count elements of a typed array, bytes of anything else. */
export function bytesOf(data: ArrayBufferView, srcOffset = 0, length?: number): Uint8Array {
  const per = 'BYTES_PER_ELEMENT' in data ? (data as unknown as { BYTES_PER_ELEMENT: number }).BYTES_PER_ELEMENT : 1;
  const count = length ?? data.byteLength / per - srcOffset;
  return new Uint8Array(data.buffer, data.byteOffset + srcOffset * per, count * per);
}

/** Throw for a write of `dstByteOffset`–`end` past a buffer of `size` bytes, which either backend drops with an error. */
export function checkBufferWrite(dstByteOffset: number, end: number, size: number): void {
  if (dstByteOffset >= 0 && end <= size) return;
  throw new RangeError(`weasel: a buffer write covers ${dstByteOffset}–${end}, past the buffer's ${size} bytes`);
}
