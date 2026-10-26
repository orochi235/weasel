// axe judges contrast against the whole document, so in the workshop it gives up on every story's text over chrome
// around it: labkit's overlay canvas, or the lab's starfield pseudo element. This re-judges that text without the chrome.

/** axe's color type, as `commons.color` hands it out. */
export interface AxeColor {
  alpha: number;
  toHexString(): string;
}

/** The part of axe's `commons` this module calls. */
export interface AxeCommons {
  dom: {
    getTextElementStack(node: Element): Element[][];
    reduceToElementsBelowFloating(stack: Element[], node: Element): Element[];
  };
  color: {
    Color: new () => AxeColor & { parseString(value: string): AxeColor };
    flattenColors(source: AxeColor, backdrop: AxeColor): AxeColor;
    hasValidContrastRatio(
      bg: AxeColor,
      fg: AxeColor,
      fontSize: number,
      isBold: boolean,
    ): { isValid: boolean; contrastRatio: number; expectedContrastRatio: number };
  };
}

export interface ContrastAxe {
  setup(node?: Element | Document): unknown;
  teardown(): void;
  commons: AxeCommons;
}

/** What the judge made of one element: decided, or still undecidable for the reason named in axe's vocabulary. */
export type ContrastVerdict =
  | { decided: true; isValid: boolean; ratio: number; expected: number; fg: string; bg: string }
  | { decided: false; key: string };

/** The axe reasons that can come from outside the audited element, and so are worth a second look. */
export const RECHECKED = new Set(['bgOverlap', 'pseudoContent', 'elmPartiallyObscured', 'elmPartiallyObscuring']);

const undecided = (key: string): ContrastVerdict => ({ decided: false, key });

/** axe's `findPseudoElement` test for one element: a positioned pseudo box with paint, larger than `minimum`. */
function pseudoArea(el: Element, which: '::before' | '::after'): number {
  const style = getComputedStyle(el, which);
  if (style.content === 'none' || style.display === 'none' || style.visibility === 'hidden' || style.position !== 'absolute') return 0;
  if (style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.backgroundImage === 'none') return 0;
  const width = parseFloat(style.width);
  const height = parseFloat(style.height);
  if (!style.width.endsWith('px') || !style.height.endsWith('px')) return width === 0 || height === 0 ? 0 : Infinity;
  return width * height;
}

function hasPseudoBackdrop(node: Element, root: Element): boolean {
  const rect = node.getBoundingClientRect();
  const minimum = rect.width * rect.height * 0.25;
  for (let el: Element | null = node; el; el = el.parentElement) {
    if (pseudoArea(el, '::before') + pseudoArea(el, '::after') > minimum) return true;
    if (el === root) return false;
  }
  return false;
}

/** Whether anything between `node` and the document root composites the text in a way this judge doesn't model. */
function hasCompositing(node: Element): boolean {
  for (let el: Element | null = node; el; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (Number(style.opacity) < 1 || style.filter !== 'none' || style.mixBlendMode !== 'normal') return true;
    if (style.backdropFilter && style.backdropFilter !== 'none') return true;
  }
  return false;
}

const isChrome = (el: Element, root: Element) => !root.contains(el) && !el.contains(root);
const paints = (style: CSSStyleDeclaration) => style.backgroundImage !== 'none' || style.backgroundColor !== 'rgba(0, 0, 0, 0)';

/**
 * The stack under each of `node`'s text rects, with chrome above it left out, or null when that chrome paints a
 * background of its own over the text. A canvas or image has content no style reveals, and counts as painting nothing.
 */
function stacksWithoutChrome(axe: ContrastAxe, node: Element, root: Element): Element[][] | null {
  const stacks: Element[][] = [];
  for (const stack of axe.commons.dom.getTextElementStack(node)) {
    const at = stack.indexOf(node);
    const above = at < 0 ? stack : stack.slice(0, at);
    if (above.some((el) => isChrome(el, root) && paints(getComputedStyle(el)))) return null;
    const kept = [...above.filter((el) => !isChrome(el, root)), ...(at < 0 ? [] : stack.slice(at))];
    stacks.push(axe.commons.dom.reduceToElementsBelowFloating(kept, node));
  }
  return stacks;
}

/** axe's `fullyEncompasses`: whether `el`'s box, or its whole scrolled extent when it scrolls, holds every rect. */
function covers(el: Element, style: CSSStyleDeclaration, rects: readonly DOMRect[]): boolean {
  const box = el.getBoundingClientRect();
  const scrolls = ['scroll', 'auto'].includes(style.overflow);
  const right = scrolls ? box.left + el.scrollWidth : box.right;
  const bottom = scrolls ? box.top + el.scrollHeight : box.bottom;
  return rects.every((r) => r.top >= box.top && r.bottom <= bottom && r.left >= box.left && r.right <= right);
}

function ownText(node: Element): string {
  let text = '';
  for (const child of node.childNodes) if (child.nodeType === Node.TEXT_NODE) text += child.textContent ?? '';
  return text.trim();
}

function textRects(node: Element): DOMRect[] {
  const range = document.createRange();
  const rects: DOMRect[] = [];
  for (const child of node.childNodes) {
    if (child.nodeType !== Node.TEXT_NODE || !child.textContent?.trim()) continue;
    range.selectNodeContents(child);
    rects.push(...range.getClientRects());
  }
  return rects;
}

/** Judges `node`'s text contrast as axe would, with the chrome around `root` out of the picture. Call between `axe.setup` and `axe.teardown`. */
export function judgeContrast(axe: ContrastAxe, node: Element, root: Element): ContrastVerdict {
  const { Color, flattenColors, hasValidContrastRatio } = axe.commons.color;
  const style = getComputedStyle(node);
  if (hasPseudoBackdrop(node, root)) return undecided('pseudoContent');
  if (style.textShadow !== 'none') return undecided('complexTextShadows');
  if (hasCompositing(node) || parseFloat(style.getPropertyValue('-webkit-text-stroke-width')) > 0) return undecided('blended');
  const stacks = stacksWithoutChrome(axe, node, root);
  if (!stacks?.length) return undecided('bgOverlap');
  for (const stack of stacks) {
    if (stack[0] !== node) return undecided('bgOverlap');
    if (stack.length !== stacks[0]!.length || stack.some((el, i) => el !== stacks[0]![i])) return undecided('elmPartiallyObscuring');
  }

  const rects = textRects(node);
  const layers: AxeColor[] = [];
  for (const el of stacks[0]!) {
    const elStyle = getComputedStyle(el);
    if (elStyle.backgroundImage !== 'none') return undecided(elStyle.backgroundImage.includes('gradient') ? 'bgGradient' : 'bgImage');
    if (el instanceof HTMLImageElement || el instanceof HTMLCanvasElement || el instanceof SVGElement) return undecided('imgNode');
    const color = new Color().parseString(elStyle.backgroundColor);
    if (color.alpha === 0) continue;
    if (elStyle.display !== 'inline' && !covers(el, elStyle, rects)) return undecided('elmPartiallyObscured');
    layers.push(color);
    if (color.alpha === 1) break;
  }
  const white = new Color().parseString('#fff');
  const bg = layers.reduceRight<AxeColor>((backdrop, layer) => flattenColors(layer, backdrop), white);
  const fg = new Color().parseString(style.getPropertyValue('-webkit-text-fill-color') || style.color);
  const bold = parseFloat(style.fontWeight) >= 700 || style.fontWeight === 'bold';
  const verdict = hasValidContrastRatio(bg, fg, parseFloat(style.fontSize), bold);
  // axe's own last word on a computed ratio: 1:1 may be hidden on purpose, and one failing character may not be text.
  if (Math.floor(verdict.contrastRatio * 100) === 100) return undecided('equalRatio');
  if (!verdict.isValid && ownText(node).length === 1) return undecided('shortTextContent');
  return {
    decided: true,
    isValid: verdict.isValid,
    ratio: verdict.contrastRatio,
    expected: verdict.expectedContrastRatio,
    fg: fg.toHexString(),
    bg: bg.toHexString(),
  };
}
