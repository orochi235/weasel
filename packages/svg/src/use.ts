/** `<use>`: drawing the element it references in its place. */

import type { Matrix, SvgNode } from './types';
import { multiply, parseTransform } from './transform';
import { readLength } from './lengths';
import { imageHref } from './readImage';
import { deriveStyle, ownValue, type StyleContext } from './cascade';

type Draw = (target: Element, ctm: Matrix, style: StyleContext) => SvgNode | SvgNode[] | null;

/** The `<use>` elements being drawn now, outermost first: one met again is a reference cycle. */
const drawing: Element[] = [];

/**
 * What `el` draws: its target under `el`'s transform, moved by its `x` and `y`,
 * inheriting from `el` rather than from where the target sits. A `<symbol>`
 * draws its children. `draw` lowers one element.
 */
export function parseUse(
  el: Element, ctm: Matrix, style: StyleContext, draw: Draw, onWarn: (m: string) => void,
): SvgNode | SvgNode[] | null {
  const href = imageHref(el);
  const target = href?.startsWith('#') ? el.ownerDocument.getElementById(href.slice(1)) : null;
  if (!target) {
    onWarn(`<use> references ${href ?? 'nothing'}, which the document does not define`);
    return null;
  }
  if (drawing.includes(el) || target.contains(el)) {
    onWarn(`<use> referencing #${target.id} is part of a reference cycle; it is not drawn`);
    return null;
  }
  const at: Matrix = [1, 0, 0, 1, readLength(el, 'x', 'x', 0, onWarn), readLength(el, 'y', 'y', 0, onWarn)];
  const m = multiply(multiply(ctm, parseTransform(el.getAttribute('transform'), onWarn)), at);
  const inner = deriveStyle(style, el);
  if (ownValue(target, 'display') === 'none') return null;
  drawing.push(el);
  try {
    if (target.tagName.toLowerCase() !== 'symbol') return draw(target, m, inner);
    if (target.hasAttribute('viewBox')) onWarn('<symbol> viewBox is not modeled; its children are not rescaled');
    const symbolStyle = deriveStyle(inner, target);
    return Array.from(target.children).flatMap((c) => draw(c, m, symbolStyle) ?? []);
  } finally {
    drawing.pop();
  }
}
