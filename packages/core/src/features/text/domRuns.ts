/**
 * Pure DOM ↔ `StyledRun[]` serializers for the contenteditable overlay
 * used by `useTextEdit`. The overlay's children are a flat sequence of
 * `<span data-run>` elements, each carrying one run's text and inline
 * styles. Newlines inside a run are literal `\n` characters; the overlay
 * has `white-space: pre-wrap` so they render as line breaks.
 */

import type { FillStyle } from 'core/paint-types';
import type { StyledRun } from './runs';

function solidColor(p: FillStyle | undefined): string | null {
  if (!p) return null;
  if ('color' in p) return p.color;
  return null;
}

interface StyleState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  letterSpacing?: number;
}

const EMPTY_STYLE: StyleState = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
};

function styleStateFromElement(el: Element, parent: StyleState): StyleState {
  const next: StyleState = { ...parent };
  const tag = el.tagName;
  if (tag === 'B' || tag === 'STRONG') next.bold = true;
  if (tag === 'I' || tag === 'EM') next.italic = true;
  // `runsToDom` never emits these, but a browser contenteditable can (Cmd+U
  // runs the native `underline` command, which produces `<u>` in Chrome), so
  // read them for the same reason `<b>`/`<i>` are read.
  if (tag === 'U') next.underline = true;
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') next.strikethrough = true;
  if (el instanceof HTMLElement) {
    const fw = el.style.fontWeight;
    if (fw === '700' || fw === 'bold') next.bold = true;
    if (fw === '400' || fw === 'normal') next.bold = false;
    const fs = el.style.fontStyle;
    if (fs === 'italic') next.italic = true;
    if (fs === 'normal') next.italic = false;
    // One declaration carries both decorations, so a present `text-decoration`
    // is authoritative for both: `none` clears an inherited underline the same
    // way `font-weight: normal` clears an inherited bold.
    const td = el.style.textDecoration;
    if (td) {
      next.underline = td.includes('underline');
      next.strikethrough = td.includes('line-through');
    }
    if (el.style.fontSize) {
      const px = parseFloat(el.style.fontSize);
      if (Number.isFinite(px)) next.fontSize = px;
    }
    if (el.style.fontFamily) next.fontFamily = el.style.fontFamily;
    if (el.style.color) next.color = el.style.color;
    const ls = el.style.letterSpacing;
    if (ls === 'normal') {
      next.letterSpacing = undefined;
    } else if (ls) {
      const px = parseFloat(ls);
      if (Number.isFinite(px)) next.letterSpacing = px;
    }
  }
  return next;
}

function styleEquals(a: StyleState, b: StyleState): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.strikethrough === b.strikethrough &&
    a.fontSize === b.fontSize &&
    a.fontFamily === b.fontFamily &&
    a.color === b.color &&
    a.letterSpacing === b.letterSpacing
  );
}

function toRun(text: string, style: StyleState): StyledRun {
  const run: StyledRun = { text };
  if (style.bold) run.bold = true;
  if (style.italic) run.italic = true;
  if (style.fontSize != null) run.fontSize = style.fontSize;
  if (style.fontFamily != null) run.fontFamily = style.fontFamily;
  if (style.color != null) run.fill = { fill: 'solid', color: style.color };
  // `letterSpacing: 0` is a meaningful override (it cancels node-level
  // tracking for this run), so test for presence, not truthiness.
  if (style.letterSpacing != null) run.letterSpacing = style.letterSpacing;
  // Run-level flags are additive over the node style — a run cannot un-set
  // one — so an undecorated run gets an absent key, never `false`.
  if (style.underline) run.underline = true;
  if (style.strikethrough) run.strikethrough = true;
  return run;
}

/** Walk an overlay tree and emit a coalesced `StyledRun[]`. */
export function domToRuns(parent: HTMLElement): StyledRun[] {
  const fragments: Array<{ text: string; style: StyleState }> = [];

  function visit(node: Node, style: StyleState): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node as Text).data;
      if (text.length > 0) fragments.push({ text, style });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (el.tagName === 'BR') {
      fragments.push({ text: '\n', style });
      return;
    }
    if (el.tagName === 'DIV' && fragments.length > 0) {
      fragments.push({ text: '\n', style });
    }
    const nextStyle = styleStateFromElement(el, style);
    for (const child of Array.from(el.childNodes)) {
      visit(child, nextStyle);
    }
  }

  for (const child of Array.from(parent.childNodes)) {
    visit(child, EMPTY_STYLE);
  }

  // Coalesce adjacent fragments with identical style.
  const runs: StyledRun[] = [];
  let i = 0;
  while (i < fragments.length) {
    let j = i + 1;
    while (j < fragments.length && styleEquals(fragments[i].style, fragments[j].style)) {
      j++;
    }
    const merged = fragments.slice(i, j).map((f) => f.text).join('');
    runs.push(toRun(merged, fragments[i].style));
    i = j;
  }
  return runs;
}

/** Build a flat sequence of `<span data-run>` children from `runs`, replacing any existing children of `parent`. */
export function runsToDom(runs: readonly StyledRun[], parent: HTMLElement): void {
  parent.replaceChildren();
  for (const run of runs) {
    const span = document.createElement('span');
    span.setAttribute('data-run', '');
    span.textContent = run.text;
    if (run.bold) span.style.fontWeight = '700';
    if (run.italic) span.style.fontStyle = 'italic';
    if (run.fontSize != null) span.style.fontSize = `${run.fontSize}px`;
    if (run.fontFamily != null) span.style.fontFamily = run.fontFamily;
    const color = solidColor(run.fill);
    if (color != null) span.style.color = color;
    // Decoration goes on the span as an inline style rather than `<u>`/`<s>`
    // wrappers: one representation for `domToRuns` to unwrap, and one element
    // per run so the caret-offset walkers stay flat.
    const decorations: string[] = [];
    if (run.underline) decorations.push('underline');
    if (run.strikethrough) decorations.push('line-through');
    if (decorations.length > 0) span.style.textDecoration = decorations.join(' ');
    // World units — the overlay's own node-level tracking is screen-scaled,
    // but a run override is stored as-is so the round-trip is lossless. CSS
    // `letter-spacing` is inherited and a child declaration *replaces* the
    // inherited value, so this composes with the overlay's rather than adding.
    if (run.letterSpacing != null) span.style.letterSpacing = `${run.letterSpacing}px`;
    parent.appendChild(span);
  }
}

/**
 * Walk the overlay's text nodes in document order and find the text node
 * + offset that corresponds to plain-text character position `offset`.
 * Offsets beyond the total text length clamp to the end of the last text
 * node. Returns `{ node: parent, offset: 0 }` when there are no text nodes.
 */
export function charOffsetToDomPosition(
  parent: HTMLElement,
  offset: number,
): { node: Node; offset: number } | null {
  let remaining = offset;
  const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  let node = walker.nextNode() as Text | null;
  while (node) {
    const len = node.data.length;
    if (remaining <= len) {
      return { node, offset: remaining };
    }
    remaining -= len;
    last = node;
    node = walker.nextNode() as Text | null;
  }
  if (last) return { node: last, offset: last.data.length };
  return { node: parent, offset: 0 };
}

/**
 * Inverse of `charOffsetToDomPosition`. Walks text nodes in document order;
 * sums the lengths of every text node preceding `node` and adds `offset`.
 * If `node` is an element (not a text node), counts to the end of the
 * preceding text content.
 */
export function domPositionToCharOffset(
  parent: HTMLElement,
  node: Node,
  offset: number,
): number {
  let total = 0;
  const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
  let cur = walker.nextNode() as Text | null;
  while (cur) {
    if (cur === node) return total + offset;
    total += cur.data.length;
    cur = walker.nextNode() as Text | null;
  }
  return total;
}
