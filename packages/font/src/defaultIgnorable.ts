/** Unicode's `Default_Ignorable_Code_Point` ranges (DerivedCoreProperties.txt). */
const RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00ad, 0x00ad], [0x034f, 0x034f], [0x061c, 0x061c], [0x115f, 0x1160],
  [0x17b4, 0x17b5], [0x180b, 0x180f], [0x200b, 0x200f], [0x202a, 0x202e],
  [0x2060, 0x206f], [0x3164, 0x3164], [0xfe00, 0xfe0f], [0xfeff, 0xfeff],
  [0xffa0, 0xffa0], [0xfff0, 0xfff8], [0x1bca0, 0x1bca3], [0x1d173, 0x1d17a],
  [0xe0000, 0xe0fff],
];

/**
 * Whether `cp` is one a renderer shows as nothing by design: joiners,
 * variation selectors, zero-width spaces, bidi controls, the soft hyphen. A
 * face serving one as no advance and no ink has served it.
 */
export function isDefaultIgnorable(cp: number): boolean {
  return RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);
}
