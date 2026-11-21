import { deriveStyle, ownValue, visibilityHides, type StyleContext } from './cascade';
import { IGNORED_TAGS } from './lowerLeaf';

export const SUPPORTED_GROUP_TAGS: ReadonlySet<string> = new Set(['g', 'svg']);

/** Whether SVG leaves `el` undrawn: `display="none"` on it, or a leaf whose
 *  `visibility` resolves hidden. That one is inherited and a descendant may
 *  turn itself back on, so a `<g>` or a `<use>` cannot answer it and is still walked. */
export function isHiddenElement(el: Element, style: StyleContext): boolean {
  const tag = el.tagName.toLowerCase();
  if (IGNORED_TAGS.has(tag)) return false;
  if (ownValue(el, 'display') === 'none') return true;
  if (SUPPORTED_GROUP_TAGS.has(tag) || tag === 'a' || tag === 'switch' || tag === 'use') return false;
  const own = deriveStyle(style, el);
  if (!visibilityHides(own)) return false;
  // A hidden text draws a tspan that turns itself back on; its other runs paint nothing.
  return tag !== 'text' || !Array.from(el.children).some((c) => c.tagName.toLowerCase() === 'tspan' && !visibilityHides(deriveStyle(own, c)));
}
