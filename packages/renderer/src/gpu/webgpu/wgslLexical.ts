/** WGSL source with every comment blanked: a line comment to its line's end, and a block comment to the
 *  close that matches its open, since WGSL block comments nest. */
export function stripWgslComments(src: string): string {
  let out = '';
  let from = 0;
  for (let i = 0; i < src.length;) {
    if (src[i] !== '/' || (src[i + 1] !== '/' && src[i + 1] !== '*')) {
      i++;
      continue;
    }
    out += src.slice(from, i) + ' ';
    if (src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      i = end < 0 ? src.length : end;
    } else {
      i += 2;
      for (let depth = 1; depth > 0 && i < src.length;) {
        if (src[i] === '/' && src[i + 1] === '*') {
          depth++;
          i += 2;
        } else if (src[i] === '*' && src[i + 1] === '/') {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
    }
    from = i;
  }
  return out + src.slice(from);
}

/** A WGSL integer literal's pattern: decimal or hex, with an optional `i` or `u` suffix. */
export const WGSL_INT = String.raw`(?:0[xX][0-9a-fA-F]+|\d+)[iu]?`;

/** A WGSL integer literal, `16`, `16u`, `0x10` or `0x10i`, as a number; `undefined` for anything else. */
export function wgslInt(s: string): number | undefined {
  if (!new RegExp(`^${WGSL_INT}$`).test(s)) return undefined;
  const digits = s.replace(/[iu]$/, '');
  return /^0[xX]/.test(digits) ? parseInt(digits.slice(2), 16) : parseInt(digits, 10);
}
