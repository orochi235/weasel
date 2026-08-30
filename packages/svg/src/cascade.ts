/**
 * SVG presentation-attribute cascade.
 *
 * Most SVG paint/text properties inherit down the element tree. Rather than
 * re-walking the DOM parent chain per attribute at leaf-emit time, the parser
 * threads a resolved `StyleContext` down through the recursion (alongside the
 * transform matrix): at each element we fold the element's own attributes onto
 * the inherited cascade once, and leaves read resolved values directly.
 */

/**
 * Raw resolved value of each inheritable presentation property in effect at a
 * point in the tree. An absent key means the property is unset all the way up,
 * and the consumer applies its own default (matching the pre-cascade
 * `readInheritedAttr` → null contract). Values are raw SVG strings; callers
 * parse them (color, number, keyword, …).
 */
export type StyleContext = Readonly<Record<string, string>>;

/** The empty cascade — seeds the root. */
export const EMPTY_STYLE: StyleContext = {};

/**
 * Inheritable presentation properties the leaf/text parsers consume. Extend
 * this list (and teach the consuming leaf to read the new key) to inherit a
 * new property — no per-attribute DOM walk required.
 */
const INHERITABLE = [
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-opacity',
  'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-miterlimit',
  'marker-start', 'marker-mid', 'marker-end',
  'color',
  'font-size', 'font-family', 'font-weight', 'font-style', 'text-anchor',
  'letter-spacing', 'text-decoration', 'direction',
] as const;

/**
 * Extract a single `style="prop:value"` declaration. Returns the trimmed value
 * or null when absent. Regex scan — not a full CSS parser; no `!important`.
 */
export function readStyleProp(el: Element, prop: string): string | null {
  const style = el.getAttribute('style');
  if (!style) return null;
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
  const m = re.exec(style);
  if (!m) return null;
  return m[1].trim();
}

/**
 * Resolve an element's own value for a property: `style=""` beats the
 * presentation attribute on the same element (SVG2 specificity).
 */
export function ownProp(el: Element, prop: string): string | null {
  return readStyleProp(el, prop) ?? el.getAttribute(prop);
}

/**
 * Fold an element's own presentation attributes onto the inherited cascade.
 * A property that is absent or literally `inherit` keeps the parent value;
 * any other own value overrides. Returns the parent unchanged (same object)
 * when the element sets no inheritable property, avoiding a needless clone.
 */
export function deriveStyle(parent: StyleContext, el: Element): StyleContext {
  let next: Record<string, string> | null = null;
  for (const prop of INHERITABLE) {
    const own = ownProp(el, prop);
    if (own == null || own === 'inherit') continue;
    if (!next) next = { ...parent };
    next[prop] = own;
  }
  return next ?? parent;
}

/**
 * Resolve a paint value that may be the `currentColor` keyword against the
 * cascade's `color`. Non-currentColor values pass through; null passes through.
 * `color`'s SVG initial value is black.
 */
export function resolveCurrentColor(raw: string | null, style: StyleContext): string | null {
  if (raw == null) return null;
  if (raw.trim().toLowerCase() === 'currentcolor') return style['color'] ?? '#000000';
  return raw;
}
