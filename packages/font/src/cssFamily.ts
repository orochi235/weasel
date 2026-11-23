/**
 * `family` as it must appear in a CSS `font` shorthand or `font-family`.
 *
 * A generic keyword has to stay bare: quoted, `"sans-serif"` names a font
 * called sans-serif, which no machine has, and the browser falls back to its
 * default serif. A single named family is quoted so a name like `Font 3D`
 * still parses. Anything holding a comma, or opening with a quote, is a CSS
 * family list the caller wrote, and passes through as written; a quote inside
 * a name (`Hoefler's Text`) is part of the name and is escaped with it.
 */
export function cssFamilyName(family: string): string {
  if (family.includes(',') || /^\s*["']/.test(family)) return family;
  return isGenericFamily(family) ? family.trim() : cssString(family);
}

/** Whether `family` is a CSS generic keyword (`sans-serif`, `system-ui`, …), which names no font of its own. */
export function isGenericFamily(family: string): boolean {
  return GENERIC_FAMILIES.has(family.trim().toLowerCase());
}

/**
 * `text` as a CSS string token, which reads back as `text`. Not `JSON.stringify`: CSS reads a backslash before a
 * letter that is not a hex digit as the letter alone, so JSON's `\n` and `\u0001` come back as `n` and `u0001`.
 * A line break must be escaped, and is written as its code point.
 */
export function cssString(text: string): string {
  return `"${text.replace(/[\\"\n\r\f]/g, (c) => (c === '\\' || c === '"' ? `\\${c}` : `\\${c.charCodeAt(0).toString(16)} `))}"`;
}

const GENERIC_FAMILIES: ReadonlySet<string> = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong',
]);
