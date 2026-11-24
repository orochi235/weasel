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

/**
 * The families of the CSS `font-family` list `list`, each as the name it denotes: quotes dropped, escapes resolved,
 * and an unquoted name's runs of whitespace read as one space. A comma inside quotes or brackets splits nothing, and
 * an entry that is a function such as `var()`, which only a browser resolves, comes back as written. Empty entries
 * are dropped.
 */
export function fontFamilies(list: string): string[] {
  const families: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i <= list.length; i++) {
    const c = list[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '\\') i++;
    else if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === undefined || (c === ',' && depth === 0)) {
      const family = familyOf(list.slice(start, i).trim());
      if (family) families.push(family);
      start = i + 1;
    }
  }
  return families;
}

function familyOf(entry: string): string {
  if (/^[\w-]+\(/.test(entry)) return entry;
  const quoted = /^(["'])([^]*)\1$/.exec(entry);
  return quoted ? cssUnescape(quoted[2]!) : cssUnescape(entry.replace(/\s+/g, ' '));
}

/** `text` with its CSS escapes resolved: `\X` to `X`, and `\` with up to six hex digits (and one trailing space)
 *  to that code point. */
export function cssUnescape(text: string): string {
  return text.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([^]))/g, (_, hex: string | undefined, ch: string | undefined) => {
    if (hex === undefined) return ch!;
    const cp = parseInt(hex, 16);
    return cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) ? '\ufffd' : String.fromCodePoint(cp);
  });
}

const GENERIC_FAMILIES: ReadonlySet<string> = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong',
]);
