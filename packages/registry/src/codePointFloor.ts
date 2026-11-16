/** `at`, or one unit sooner when it falls between the halves of a surrogate pair: the longest prefix of `s` no
 *  longer than `at` units that keeps every code point whole. */
export function codePointFloor(s: string, at: number): number {
  const before = s.charCodeAt(at - 1);
  const after = s.charCodeAt(at);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff ? at - 1 : at;
}
