/**
 * Pure DOM ↔ `StyledRun[]` serializers for the contenteditable overlay
 * used by `useTextEdit`. The overlay's children are a flat sequence of
 * `<span data-run>` elements, each carrying one run's text and inline
 * styles. Newlines inside a run are literal `\n` characters; the overlay
 * has `white-space: pre-wrap` so they render as line breaks. The browser
 * breaks at no other UAX #14 hard break, so each of those is written as a
 * `<span data-break>` holding a `\n` in its place — one character for one,
 * which keeps DOM offsets equal to source offsets.
 *
 * A small-caps run is the one exception to one text node per span: its
 * lowercase letters sit in `<span data-small-caps>` pieces, uppercased and
 * sized at the scale the canvas draws them with, since a browser's own
 * synthesis uses a fixed factor of its own. The pieces are presentation
 * only — `domToRuns` reads straight through them.
 */

import type { FillStyle } from '@weasel-js/paint';
import {
  DEFAULT_TEXT_STYLE, isHardLineBreak, numericWeight, smallCapsScaleFor, smallCapsText, transformRunTexts,
  SMALL_CAPS_SCALE,
  type FontVariantCaps, type ResolvedTextStyle, type StyledRun, type TextTransform,
} from '@weasel-js/text';
import { cssFontFamily } from '@weasel-js/font';

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
  overline: boolean;
  fontWeight?: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  letterSpacing?: number;
  script?: 'super' | 'sub';
  baselineShift?: number;
  fontScale?: number;
  textTransform?: TextTransform;
  fontVariantCaps?: FontVariantCaps;
}

const TRANSFORMS: ReadonlySet<string> = new Set(['none', 'uppercase', 'lowercase', 'capitalize']);

const EMPTY_STYLE: StyleState = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  overline: false,
};

/**
 * Parse a CSS `letter-spacing` value into world units. `runsToDom` only ever
 * writes `px`, but paste is a live path into the contenteditable and CSSOM
 * keeps whatever unit the pasted markup used. Any other unit is still
 * numerically coerced — `parseFloat` reads the leading digits — but flagged,
 * since e.g. `0.1em` silently becomes `0.1` world units, off by a factor of
 * the font size. Mirrors `parseLetterSpacing` in the SVG reader.
 */
function parseLetterSpacing(raw: string): number | undefined {
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return undefined;
  const unit = /^-?[\d.]+([a-z%]+)$/i.exec(raw.trim())?.[1]?.toLowerCase();
  if (unit && unit !== 'px') {
    console.warn(
      `weasel domRuns: letter-spacing "${raw}" uses unit "${unit}", which is not converted; treated as ${n} world units`,
    );
  }
  return n;
}

/** A small-caps piece is presentation `runsToDom` split a run into, not styling. */
const isSmallCapsPiece = (el: Element): boolean => el.hasAttribute('data-small-caps');

/** The element's own `font-variant`, from the shorthand or the caps longhand
 *  pasted markup may carry alone. */
function cssFontVariant(el: HTMLElement): FontVariantCaps | undefined {
  const v = el.style.fontVariant || el.style.getPropertyValue('font-variant-caps');
  return v === 'small-caps' || v === 'normal' ? v : undefined;
}

function styleStateFromElement(el: Element, parent: StyleState): StyleState {
  if (isSmallCapsPiece(el)) return parent;
  const next: StyleState = { ...parent };
  const tag = el.tagName;
  if (tag === 'B' || tag === 'STRONG') {
    next.bold = true;
    next.fontWeight = undefined;
  }
  if (tag === 'I' || tag === 'EM') next.italic = true;
  // `runsToDom` never emits these, but a browser contenteditable can (Cmd+U
  // runs the native `underline` command, which produces `<u>` in Chrome), so
  // read them for the same reason `<b>`/`<i>` are read.
  if (tag === 'U') next.underline = true;
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') next.strikethrough = true;
  if (tag === 'SUP') next.script = 'super';
  if (tag === 'SUB') next.script = 'sub';
  if (el instanceof HTMLElement) {
    // 700 and 400 are the bold flag on and off, which is what pasted markup
    // means by them. A run's own weight is written with an attribute beside
    // the CSS, so a stored 400 or 700 comes back as the weight it was.
    const fw = el.style.fontWeight;
    const ownWeight = Number(el.getAttribute('data-font-weight') ?? fw);
    if (el.hasAttribute('data-font-weight') || !['', '700', 'bold', '400', 'normal'].includes(fw)) {
      if (Number.isFinite(ownWeight) && ownWeight > 0) {
        next.fontWeight = ownWeight;
        next.bold = false;
      }
    } else if (fw !== '') {
      next.bold = fw === '700' || fw === 'bold';
      next.fontWeight = undefined;
    }
    const fs = el.style.fontStyle;
    if (fs === 'italic') next.italic = true;
    if (fs === 'normal') next.italic = false;
    // Decoration accumulates down the tree — unlike `font-weight`/`font-style`
    // above, `text-decoration` does not inherit, it *propagates*, and a
    // descendant cannot cancel what an ancestor drew. So OR the flags in
    // rather than overwriting: `<u><span style="text-decoration: line-through">`
    // renders both lines, and that is a reachable shape here, since `runsToDom`
    // emits the span and an unintercepted Cmd+U supplies the `<u>`. An explicit
    // `none` contributes no tokens and cancels nothing.
    //
    // A declaration block carrying only the longhand serializes the shorthand
    // as `''` (the shorthand needs the full set), and browsers and pasted HTML
    // both produce that, so fall back to `text-decoration-line`.
    const td = el.style.textDecoration || el.style.textDecorationLine;
    if (td && !td.includes('none')) {
      next.underline ||= td.includes('underline');
      next.strikethrough ||= td.includes('line-through');
      next.overline ||= td.includes('overline');
    }
    // A percentage is `fontScale`'s own spelling — CSS resolves it against the
    // parent, which is exactly what the field means. Any other unit is an
    // absolute size.
    if (el.style.fontSize) {
      const size = parseFloat(el.style.fontSize);
      if (Number.isFinite(size)) {
        if (el.style.fontSize.trim().endsWith('%')) next.fontScale = size / 100;
        else next.fontSize = size;
      }
    }
    const va = el.style.verticalAlign;
    if (va === 'super' || va === 'sub') next.script = va === 'super' ? 'super' : 'sub';
    if (va === 'baseline') next.script = undefined;
    const rawShift = el.getAttribute('data-baseline-shift');
    if (rawShift != null) {
      const shift = parseFloat(rawShift);
      if (Number.isFinite(shift)) next.baselineShift = shift;
    }
    const tt = el.style.textTransform;
    if (TRANSFORMS.has(tt)) next.textTransform = tt as TextTransform;
    const fv = cssFontVariant(el);
    if (fv) next.fontVariantCaps = fv;
    // The attribute holds the run's family; the CSS holds the face it maps to.
    const family = el.getAttribute('data-font-family') ?? el.style.fontFamily;
    if (family) next.fontFamily = family;
    if (el.style.color) next.color = el.style.color;
    const ls = el.style.letterSpacing;
    if (ls === 'normal') {
      next.letterSpacing = undefined;
    } else if (ls) {
      const px = parseLetterSpacing(ls);
      if (px != null) next.letterSpacing = px;
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
    a.overline === b.overline &&
    a.fontWeight === b.fontWeight &&
    a.fontSize === b.fontSize &&
    a.fontFamily === b.fontFamily &&
    a.color === b.color &&
    a.letterSpacing === b.letterSpacing &&
    a.script === b.script &&
    a.baselineShift === b.baselineShift &&
    a.fontScale === b.fontScale &&
    a.textTransform === b.textTransform &&
    a.fontVariantCaps === b.fontVariantCaps
  );
}

function toRun(text: string, style: StyleState): StyledRun {
  const run: StyledRun = { text };
  if (style.bold) run.bold = true;
  if (style.italic) run.italic = true;
  if (style.fontWeight != null) run.fontWeight = style.fontWeight;
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
  if (style.overline) run.overline = true;
  if (style.script != null) run.script = style.script;
  // Both are meaningful at values that test falsy — a 0 shift cancels an
  // inherited script's rise — so test for presence, as `letterSpacing` does.
  if (style.baselineShift != null) run.baselineShift = style.baselineShift;
  if (style.fontScale != null) run.fontScale = style.fontScale;
  if (style.textTransform != null) run.textTransform = style.textTransform;
  if (style.fontVariantCaps != null) run.fontVariantCaps = style.fontVariantCaps;
  return run;
}

const BREAK_ATTR = 'data-break';

/** A break stand-in's source text: its hard break, and anything typed into it after. */
function restoreBreak(el: Element): string {
  const text = el.textContent ?? '';
  const code = parseInt(el.getAttribute(BREAK_ATTR) ?? '', 16);
  return text.startsWith('\n') && Number.isFinite(code) ? String.fromCharCode(code) + text.slice(1) : text;
}

/**
 * Append `text` to `parent` as the overlay sets it: a hard break the browser
 * would not break at becomes a `<span data-break>` holding a `\n`, carrying
 * the original's code as hex for `domToRuns` to restore. A CR that opens a
 * CRLF is left as it is — the LF breaks, and the CR draws nothing.
 */
export function appendOverlayText(parent: Node, text: string): void {
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 10 || !isHardLineBreak(c) || (c === 13 && text.charCodeAt(i + 1) === 10)) continue;
    if (i > from) parent.appendChild(document.createTextNode(text.slice(from, i)));
    const span = document.createElement('span');
    span.setAttribute(BREAK_ATTR, c.toString(16));
    span.textContent = '\n';
    parent.appendChild(span);
    from = i + 1;
  }
  if (from < text.length) parent.appendChild(document.createTextNode(text.slice(from)));
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
    if (el.hasAttribute(BREAK_ATTR)) {
      const restored = restoreBreak(el);
      if (restored.length > 0) fragments.push({ text: restored, style });
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

/** What a run inherits from its node, for the overlay's small caps: which
 *  runs have it, and the face and transform that decide their pieces. */
export type OverlayRunBase = Pick<
  ResolvedTextStyle, 'fontFamily' | 'fontWeight' | 'fontStyle' | 'textTransform' | 'fontVariantCaps'
>;

/** The custom property carrying a small-caps run's scale down to its pieces. */
export const SMALL_CAPS_SCALE_PROPERTY = '--weasel-small-caps';

/** A run's source text cut where small caps changes size, per `smallCapsText`
 *  over the text as `transform` draws it. */
function smallCapsPieces(text: string, transform: TextTransform): Array<{ text: string; small: boolean }> {
  const [shown] = transformRunTexts([text], [transform]);
  const caps = smallCapsText(shown.text, shown.srcMap);
  const small = new Array<boolean>(text.length).fill(false);
  caps.small?.forEach((s, i) => {
    if (s) small[caps.srcMap ? caps.srcMap.starts[i] : i] = true;
  });
  const out: Array<{ text: string; small: boolean }> = [];
  let at = 0;
  for (const ch of text) {
    const last = out[out.length - 1];
    if (last && last.small === small[at]) last.text += ch;
    else out.push({ text: ch, small: small[at] });
    at += ch.length;
  }
  return out;
}

/** Replace `span`'s children with `text`, its small-caps letters in pieces. */
function writeSmallCaps(span: HTMLElement, text: string, transform: TextTransform): void {
  span.replaceChildren();
  for (const p of smallCapsPieces(text, transform)) {
    if (!p.small) { appendOverlayText(span, p.text); continue; }
    const piece = document.createElement('span');
    piece.setAttribute('data-small-caps', '');
    piece.style.fontSize = `calc(var(${SMALL_CAPS_SCALE_PROPERTY}, ${SMALL_CAPS_SCALE}) * 1em)`;
    piece.style.textTransform = 'uppercase';
    piece.textContent = p.text;
    span.appendChild(piece);
  }
}

/**
 * Build a flat sequence of `<span data-run>` children from `runs`, replacing
 * any existing children of `parent`. `base` is the node's style, which a run
 * inheriting small caps needs to be split by; without it the kit defaults
 * stand in.
 */
export function runsToDom(
  runs: readonly StyledRun[],
  parent: HTMLElement,
  base: OverlayRunBase = DEFAULT_TEXT_STYLE,
): void {
  parent.replaceChildren();
  for (const run of runs) {
    const span = document.createElement('span');
    span.setAttribute('data-run', '');
    if ((run.fontVariantCaps ?? base.fontVariantCaps) === 'small-caps') {
      const scale = smallCapsScaleFor(
        run.fontFamily ?? base.fontFamily,
        run.fontWeight ?? (run.bold ? 700 : numericWeight(base.fontWeight)),
        run.italic ? 'italic' : base.fontStyle,
      );
      span.style.setProperty(SMALL_CAPS_SCALE_PROPERTY, String(scale));
      writeSmallCaps(span, run.text, run.textTransform ?? base.textTransform);
    } else {
      appendOverlayText(span, run.text);
    }
    // CSS as well as the pieces: it is what pasted markup says, and it gives a
    // letter typed outside a piece a small cap until the next normalize.
    if (run.fontVariantCaps != null) span.style.fontVariant = run.fontVariantCaps;
    if (run.fontWeight != null) {
      span.style.fontWeight = String(run.fontWeight);
      span.setAttribute('data-font-weight', String(run.fontWeight));
    } else if (run.bold) span.style.fontWeight = '700';
    if (run.italic) span.style.fontStyle = 'italic';
    // An absolute size wins over a relative one, as it does in `resolveRuns`.
    if (run.fontSize != null) span.style.fontSize = `${run.fontSize}px`;
    else if (run.fontScale != null) span.style.fontSize = `${run.fontScale * 100}%`;
    if (run.fontFamily != null) {
      span.style.fontFamily = cssFontFamily(run.fontFamily, {
        weight: run.fontWeight ?? (run.bold ? 700 : undefined),
        style: run.italic ? 'italic' : undefined,
      });
      span.setAttribute('data-font-family', run.fontFamily);
    }
    const color = solidColor(run.fill);
    if (color != null) span.style.color = color;
    // Decoration goes on the span as an inline style rather than `<u>`/`<s>`
    // wrappers: one representation for `domToRuns` to unwrap, and one element
    // per run so the caret-offset walkers stay flat.
    const decorations: string[] = [];
    if (run.underline) decorations.push('underline');
    if (run.strikethrough) decorations.push('line-through');
    if (run.overline) decorations.push('overline');
    if (decorations.length > 0) span.style.textDecoration = decorations.join(' ');
    if (run.script != null) span.style.verticalAlign = run.script;
    // The one run field with no CSS spelling: `vertical-align` takes a length
    // or a percentage of the *line height*, and this is a fraction of the
    // parent's font size. An attribute keeps the round-trip exact; the canvas
    // underneath is what actually draws the run at its offset.
    if (run.baselineShift != null) {
      span.setAttribute('data-baseline-shift', String(run.baselineShift));
    }
    // World units — the overlay's own node-level tracking is screen-scaled,
    // but a run override is stored as-is so the round-trip is lossless. CSS
    // `letter-spacing` is inherited and a child declaration *replaces* the
    // inherited value, so this composes with the overlay's rather than adding.
    if (run.letterSpacing != null) span.style.letterSpacing = `${run.letterSpacing}px`;
    // CSS draws the transform, so the span's text stays the source and the
    // caret-offset walkers below need no map.
    if (run.textTransform != null) span.style.textTransform = run.textTransform;
    parent.appendChild(span);
  }
}

/** `el`'s text as `domToRuns` reads it: each break stand-in restored. */
function sourceText(el: Element): string {
  let out = '';
  for (const n of el.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) out += (n as Text).data;
    else if (n instanceof Element) out += n.hasAttribute(BREAK_ATTR) ? restoreBreak(n) : sourceText(n);
  }
  return out;
}

/** Whether `span`'s children are the pieces `writeSmallCaps` would write. */
function piecesMatch(span: HTMLElement, transform: TextTransform): boolean {
  const want = smallCapsPieces(sourceText(span), transform);
  const have: Array<{ text: string; small: boolean }> = [];
  for (const n of span.childNodes) {
    let small: boolean;
    let text: string;
    if (n.nodeType === Node.TEXT_NODE) { small = false; text = (n as Text).data; }
    else if (n instanceof HTMLElement && n.hasAttribute(BREAK_ATTR)) { small = false; text = restoreBreak(n); }
    else if (n instanceof HTMLElement && isSmallCapsPiece(n) && n.children.length === 0) { small = true; text = n.textContent ?? ''; }
    else return false;
    if (text.length === 0) continue;
    const last = have[have.length - 1];
    if (last && last.small === small) last.text += text;
    else have.push({ text, small });
  }
  return want.length === have.length
    && want.every((p, i) => p.text === have[i].text && p.small === have[i].small);
}

/**
 * Put every run span's small-caps pieces back where its text now needs them —
 * typing lands a letter in whichever piece holds the caret, not the one its
 * case belongs in. Returns whether anything was rewritten, which moves the
 * DOM selection: the caller restores it by character offset.
 */
export function normalizeSmallCaps(parent: HTMLElement): boolean {
  let changed = false;
  const visit = (el: HTMLElement, variant: FontVariantCaps, transform: TextTransform): void => {
    const v = cssFontVariant(el) ?? variant;
    const tt = el.style.textTransform;
    const t = TRANSFORMS.has(tt) ? (tt as TextTransform) : transform;
    if (el.hasAttribute('data-run')) {
      if (v === 'small-caps') {
        if (!piecesMatch(el, t)) { writeSmallCaps(el, sourceText(el), t); changed = true; }
      } else if (el.querySelector('[data-small-caps]')) {
        const text = sourceText(el);
        el.replaceChildren();
        appendOverlayText(el, text);
        changed = true;
      }
      return;
    }
    for (const child of el.children) if (child instanceof HTMLElement) visit(child, v, t);
  };
  visit(parent, 'normal', 'none');
  return changed;
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
 *
 * When `node` is an element the DOM offset indexes *child nodes*, not
 * characters, so it can't simply be added — `(overlay, 0)` is the start of
 * the text and `(overlay, childNodes.length)` its end. That shape is not
 * exotic: `Range.selectNodeContents`, which `useTextEdit` uses for its
 * select-all caret, produces exactly it. So resolve an element position by
 * counting the text that precedes the boundary point. A text node can never
 * *contain* that point (the container isn't one), so each is wholly before
 * or wholly after it.
 */
export function domPositionToCharOffset(
  parent: HTMLElement,
  node: Node,
  offset: number,
): number {
  let total = 0;
  const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
  let cur = walker.nextNode() as Text | null;
  if (node.nodeType === Node.TEXT_NODE) {
    while (cur) {
      if (cur === node) return total + offset;
      total += cur.data.length;
      cur = walker.nextNode() as Text | null;
    }
    return total;
  }
  const point = document.createRange();
  point.setStart(node, Math.max(0, Math.min(offset, node.childNodes.length)));
  point.collapse(true);
  while (cur) {
    if (point.comparePoint(cur, 0) < 0) total += cur.data.length;
    cur = walker.nextNode() as Text | null;
  }
  return total;
}
