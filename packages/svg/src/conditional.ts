/** SVG conditional processing: `<switch>`, `systemLanguage` and `requiredExtensions`. */

import { SUPPORTED_LEAF_TAGS } from './lowerLeaf';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** What this parser draws; `<switch>` passes over any other child for the next one. */
const DRAWN_TAGS = new Set([...SUPPORTED_LEAF_TAGS, 'text', 'image', 'g', 'a', 'svg', 'switch']);

/** The reader's languages, most preferred first; none outside a browser-like host. */
function userLanguages(): readonly string[] {
  const nav = (globalThis as { navigator?: { languages?: readonly string[]; language?: string } }).navigator;
  return nav?.languages ?? (nav?.language ? [nav.language] : []);
}

/**
 * Whether `el`'s conditional processing attributes hold. This parser knows no
 * extension, so any `requiredExtensions` fails; `systemLanguage` holds when a
 * user language equals one it lists, or is a prefix of one up to a `-`.
 */
export function conditionsHold(el: Element): boolean {
  if (el.hasAttribute('requiredExtensions')) return false;
  const langs = el.getAttribute('systemLanguage');
  if (langs == null) return true;
  const user = userLanguages().map((l) => l.toLowerCase());
  return langs.split(',').map((l) => l.trim().toLowerCase()).filter(Boolean)
    .some((l) => user.some((u) => l === u || l.startsWith(`${u}-`)));
}

/**
 * The children a container draws. A `<switch>` draws its first child whose
 * conditions hold and that this parser can draw, so a fallback written for
 * renderers without `<foreignObject>` is the one taken.
 */
export function drawnChildren(el: Element, onWarn: (m: string) => void): ArrayLike<Element> {
  const tag = el.tagName.toLowerCase();
  if (tag === 'a' && (el.hasAttribute('href') || el.hasAttribute('xlink:href'))) {
    onWarn('<a> is read as a group; its link is not kept');
  }
  if (tag !== 'switch') return el.children;
  for (const child of Array.from(el.children)) {
    if (child.namespaceURI !== SVG_NS || !conditionsHold(child)) continue;
    if (DRAWN_TAGS.has(child.tagName.toLowerCase())) return [child];
  }
  return [];
}
