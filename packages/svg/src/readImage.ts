/** Reading `<image>`, bare or cropped by a nested `<svg>`. */

import type { Matrix, SvgImageNode } from './types';
import { multiply, parseTransform } from './transform';
import { placeNode } from './placeBox';
import { readLength } from './lengths';
import { ownValue } from './cascade';
import { parseViewBoxAttr } from './viewBox';

const XLINK_NS = 'http://www.w3.org/1999/xlink';

export function parseImageElement(
  el: Element,
  ctm: Matrix,
  onWarn: (m: string) => void,
): SvgImageNode | null {
  const href = imageHref(el);
  if (!href) {
    onWarn('<image> without href; dropped');
    return null;
  }
  const node = imageNodeAt(el, el, href, ctm, onWarn);
  if (el.hasAttribute('preserveAspectRatio')
    && el.getAttribute('preserveAspectRatio') !== 'none') {
    onWarn('<image> preserveAspectRatio is not modeled; the box is taken literally');
  }
  return node;
}

export function imageHref(el: Element): string | null {
  return el.getAttribute('href')
    ?? el.getAttributeNS(XLINK_NS, 'href')
    ?? el.getAttribute('xlink:href');
}

/**
 * The image node whose box is `boxEl`'s `x` / `y` / `width` / `height` and
 * whose rotation and opacity are `ownerEl`'s. The two are one element for a
 * plain `<image>`, and the viewport and its wrapping `<g>` for the cropped
 * form `serialize.ts` writes.
 */
function imageNodeAt(
  boxEl: Element,
  ownerEl: Element,
  href: string,
  ctm: Matrix,
  onWarn: (m: string) => void,
): SvgImageNode {
  const rawX = readLength(boxEl, 'x', 'x', 0, onWarn);
  const rawY = readLength(boxEl, 'y', 'y', 0, onWarn);
  const rawW = readLength(boxEl, 'width', 'x', 0, onWarn);
  const rawH = readLength(boxEl, 'height', 'y', 0, onWarn);
  const node: SvgImageNode = { kind: 'image', href, x: rawX, y: rawY, width: rawW, height: rawH };
  const opacity = ownValue(ownerEl, 'opacity');
  if (opacity != null) node.opacity = opacity;
  const localTransform = parseTransform(ownerEl.getAttribute('transform'), onWarn);
  placeNode(node, 'image', multiply(ctm, localTransform), true, onWarn);
  return node;
}

/**
 * Read back the cropped image form `serialize.ts` writes for a source rect or
 * a flip: `<g data-weasel-image>` → `<svg viewBox>` → unit-square `<image>`.
 * `null` when the group does not have that shape, so the caller parses it as
 * an ordinary group.
 */
export function parseCroppedImage(
  g: Element,
  ctm: Matrix,
  onWarn: (m: string) => void,
): SvgImageNode | null {
  const viewport = [...g.children].find((c) => c.tagName.toLowerCase() === 'svg');
  const img = viewport && [...viewport.children].find((c) => c.tagName.toLowerCase() === 'image');
  const href = img && imageHref(img);
  const source = viewport && parseViewBoxAttr(viewport.getAttribute('viewBox'));
  if (!img || !href || !source) return null;
  const node = imageNodeAt(viewport, g, href, ctm, onWarn);
  if (source.x !== 0 || source.y !== 0 || source.width !== 1 || source.height !== 1) {
    node.source = source;
  }
  const flip = parseTransform(img.getAttribute('transform'), onWarn);
  // Toggled, not set: the group's own transform may already have mirrored it.
  if (flip[0] < 0) toggle(node, 'flipX');
  if (flip[3] < 0) toggle(node, 'flipY');
  return node;
}

function toggle(node: SvgImageNode, key: 'flipX' | 'flipY'): void {
  if (node[key]) delete node[key];
  else node[key] = true;
}
