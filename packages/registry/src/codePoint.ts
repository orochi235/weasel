/** `at`, or one unit sooner when it falls between the halves of a surrogate pair: the longest prefix of `s` no
 *  longer than `at` units that keeps every code point whole. */
export function codePointFloor(s: string, at: number): number {
  const before = s.charCodeAt(at - 1);
  const after = s.charCodeAt(at);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff ? at - 1 : at;
}

/** Whether `text` is one typed character, counted by code point: an emoji is one, though it takes two UTF-16 units. */
export function isOneChar(text: string): boolean {
  return text.length > 0 && text.length <= 2 && [...text].length === 1;
}
