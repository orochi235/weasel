/**
 * DOM ↔ `StyledRun[]` serializers for the contenteditable overlay: a flat
 * sequence of `<span data-run>` elements, one per run. The browser breaks at
 * `\n` and at no other UAX #14 hard break, so each of those is written as a
 * `<span data-break>` holding a `\n` in its place — one character for one,
 * which keeps DOM offsets equal to source offsets.
 *
 * A small-caps run's lowercase letters sit in `<span data-small-caps>` pieces,
 * uppercased and sized at the scale the canvas draws them with, since a
 * browser's own synthesis uses a fixed factor of its own.
 */

import { isSolidPaint, type Paint } from '@weasel-js/paint';
import {
  DEFAULT_TEXT_STYLE, isHardLineBreak, numericWeight, smallCapsScaleFor, smallCapsText, transformRunTexts,
  SMALL_CAPS_SCALE,
  type FontVariantCaps, type ResolvedTextStyle, type StyledRun, type TextTransform,
} from '@weasel-js/text';
import { cssFontFamily } from '@weasel-js/font';
import { BLOCK_TAGS } from './domOffsets';
import {
  cssFontVariant, EMPTY_STYLE, FILL_ATTR, isSmallCapsPiece, ROTATE_ATTR, STROKE_ATTR, styleEquals,
  styleStateFromElement, toRun, TRANSFORMS, type StyleState,
} from './runStyle';

export { charOffsetToDomPosition, domPositionToCharOffset } from './domOffsets';

function solidColor(p: Paint | null | undefined): string | null {
  if (!p) return null;
  if (isSolidPaint(p)) return p.color;
  return null;
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
 * the original's code as hex. A CR that opens a CRLF is left as it is — the
 * LF breaks, and the CR draws nothing.
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
    if (BLOCK_TAGS.has(el.tagName) && fragments.length > 0) {
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
  ResolvedTextStyle, 'fontFamily' | 'fontWeight' | 'fontStyle' | 'textTransform' | 'fontVariantCaps' | 'lang'
>;

/** The custom property carrying a small-caps run's scale down to its pieces. */
export const SMALL_CAPS_SCALE_PROPERTY = '--weasel-small-caps';

/** A run's source text cut where small caps changes size, per `smallCapsText`
 *  over the text as `transform` draws it. */
function smallCapsPieces(
  text: string, transform: TextTransform, lang: string | undefined,
): Array<{ text: string; small: boolean }> {
  const [shown] = transformRunTexts([text], [transform], [lang]);
  const caps = smallCapsText(shown.text, shown.srcMap, lang);
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
function writeSmallCaps(span: HTMLElement, text: string, transform: TextTransform, lang: string | undefined): void {
  span.replaceChildren();
  for (const p of smallCapsPieces(text, transform, lang)) {
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
 * Replace `parent`'s children with one `<span data-run>` per run. `base` is
 * the node's style, which a run inheriting small caps is split by.
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
      writeSmallCaps(span, run.text, run.textTransform ?? base.textTransform, run.lang ?? base.lang);
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
    const color = solidColor(run.fill?.paint);
    if (color != null) span.style.color = color;
    else if (run.fill !== undefined) span.setAttribute(FILL_ATTR, JSON.stringify(run.fill));
    // Black, as an unfilled node edits in: no CSS color leaves it legible.
    if (run.fill === null) span.style.color = '#000';
    if (run.stroke !== undefined) span.setAttribute(STROKE_ATTR, JSON.stringify(run.stroke));
    if (run.rotate != null) span.setAttribute(ROTATE_ATTR, String(run.rotate));
    if (run.lang) span.lang = run.lang;
    // Decoration goes on the span as an inline style rather than `<u>`/`<s>`
    // wrappers: one representation for `domToRuns` to unwrap, and one element
    // per run so the caret-offset walkers stay flat.
    const decorations: string[] = [];
    if (run.underline) decorations.push('underline');
    if (run.strikethrough) decorations.push('line-through');
    if (run.overline) decorations.push('overline');
    if (decorations.length > 0) span.style.textDecoration = decorations.join(' ');
    if (run.script != null) span.style.verticalAlign = run.script;
    // No CSS spelling: `vertical-align` takes a length or a percentage of the
    // *line height*, and this is a fraction of the parent's font size.
    if (run.baselineShift != null) {
      span.setAttribute('data-baseline-shift', String(run.baselineShift));
    }
    // World units — the overlay's own node-level tracking is screen-scaled,
    // but a run override is stored as-is so the round-trip is lossless.
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
function piecesMatch(span: HTMLElement, transform: TextTransform, lang: string | undefined): boolean {
  const want = smallCapsPieces(sourceText(span), transform, lang);
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
 * Put every run span's small-caps pieces back where its text now needs them.
 * Returns whether anything was rewritten, which moves the DOM selection: the
 * caller restores it by character offset.
 */
export function normalizeSmallCaps(parent: HTMLElement): boolean {
  let changed = false;
  const visit = (
    el: HTMLElement, variant: FontVariantCaps, transform: TextTransform, inherited: string | undefined,
  ): void => {
    const v = cssFontVariant(el) ?? variant;
    const tt = el.style.textTransform;
    const t = TRANSFORMS.has(tt) ? (tt as TextTransform) : transform;
    const lang = el.hasAttribute('lang') ? el.lang || undefined : inherited;
    if (el.hasAttribute('data-run')) {
      if (v === 'small-caps') {
        if (!piecesMatch(el, t, lang)) { writeSmallCaps(el, sourceText(el), t, lang); changed = true; }
      } else if (el.querySelector('[data-small-caps]')) {
        const text = sourceText(el);
        el.replaceChildren();
        appendOverlayText(el, text);
        changed = true;
      }
      return;
    }
    for (const child of el.children) if (child instanceof HTMLElement) visit(child, v, t, lang);
  };
  visit(parent, 'normal', 'none', undefined);
  return changed;
}
