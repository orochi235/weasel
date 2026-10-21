/** Each char code as one byte: PDF syntax is ASCII, and binary strings here hold one byte per code. */
export function latin1Bytes(s: string): Uint8Array {
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/** The inverse of `latin1Bytes`. */
export function latin1(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i] as number);
  return s;
}
