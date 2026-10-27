/**
 * A run's style as the overlay's DOM carries it: what an element and its
 * ancestors say, read into a `StyleState`, and a `StyledRun` built from one.
 */

import type { Fill, Stroke } from '@weasel-js/paint';
import type { FontVariantCaps, StyledRun, TextTransform } from '@weasel-js/text';

/** Holds, as JSON, a run fill its span's CSS color cannot say: a gradient, a
 *  pattern, or `null` for no fill. */
export const FILL_ATTR = 'data-fill';

/** Holds, as JSON, a run's stroke, which the overlay does not draw. */
export const STROKE_ATTR = 'data-stroke';

/** Holds a run's glyph turn in degrees, which CSS has no per-glyph spelling for. */
export const ROTATE_ATTR = 'data-rotate';

export interface StyleState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  overline: boolean;
  fontWeight?: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  /** `FILL_ATTR`'s value, which wins over `color`. */
  fillJson?: string;
  /** `STROKE_ATTR`'s value. */
  strokeJson?: string;
  rotate?: number;
  letterSpacing?: number;
  script?: 'super' | 'sub';
  baselineShift?: number;
  fontScale?: number;
  textTransform?: TextTransform;
  fontVariantCaps?: FontVariantCaps;
}

export const TRANSFORMS: ReadonlySet<string> = new Set(['none', 'uppercase', 'lowercase', 'capitalize']);

export const EMPTY_STYLE: StyleState = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  overline: false,
};

/**
 * Parse a CSS `letter-spacing` value into world units. Pasted markup can carry
 * a unit other than `px`; it is read as its bare number and flagged, since
 * `0.1em` becomes `0.1` world units, off by a factor of the font size.
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
export const isSmallCapsPiece = (el: Element): boolean => el.hasAttribute('data-small-caps');

/** The element's own `font-variant`, from the shorthand or the caps longhand
 *  pasted markup may carry alone. */
export function cssFontVariant(el: HTMLElement): FontVariantCaps | undefined {
  const v = el.style.fontVariant || el.style.getPropertyValue('font-variant-caps');
  return v === 'small-caps' || v === 'normal' ? v : undefined;
}

/** `el`'s `name` attribute where it holds JSON. Pasted markup can carry
 *  anything there, and `toRun` parses it. */
function jsonAttr(el: Element, name: string): string | undefined {
  const raw = el.getAttribute(name);
  if (raw == null) return undefined;
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    return undefined;
  }
}

export function styleStateFromElement(el: Element, parent: StyleState): StyleState {
  if (isSmallCapsPiece(el)) return parent;
  const next: StyleState = { ...parent };
  const tag = el.tagName;
  if (tag === 'B' || tag === 'STRONG') {
    next.bold = true;
    next.fontWeight = undefined;
  }
  if (tag === 'I' || tag === 'EM') next.italic = true;
  // `runsToDom` never emits these, but a browser contenteditable can: Cmd+U
  // runs the native `underline` command, which produces `<u>` in Chrome.
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
    // `text-decoration` does not inherit, it *propagates*, and a descendant
    // cannot cancel what an ancestor drew — so OR the flags in rather than
    // overwriting, and an explicit `none` cancels nothing.
    //
    // A declaration block carrying only the longhand serializes the shorthand
    // as `''`, so fall back to `text-decoration-line`.
    const td = el.style.textDecoration || el.style.textDecorationLine;
    if (td && !td.includes('none')) {
      next.underline ||= td.includes('underline');
      next.strikethrough ||= td.includes('line-through');
      next.overline ||= td.includes('overline');
    }
    // A percentage is `fontScale`; any other unit is an absolute size.
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
    const strokeJson = jsonAttr(el, STROKE_ATTR);
    if (strokeJson !== undefined) next.strokeJson = strokeJson;
    const rotate = parseFloat(el.getAttribute(ROTATE_ATTR) ?? '');
    if (Number.isFinite(rotate)) next.rotate = rotate;
    const fillJson = jsonAttr(el, FILL_ATTR);
    if (fillJson !== undefined) {
      next.fillJson = fillJson;
      next.color = undefined;
    } else if (el.style.color) {
      next.color = el.style.color;
      next.fillJson = undefined;
    }
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

export function styleEquals(a: StyleState, b: StyleState): boolean {
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
    a.fillJson === b.fillJson &&
    a.strokeJson === b.strokeJson &&
    a.rotate === b.rotate &&
    a.letterSpacing === b.letterSpacing &&
    a.script === b.script &&
    a.baselineShift === b.baselineShift &&
    a.fontScale === b.fontScale &&
    a.textTransform === b.textTransform &&
    a.fontVariantCaps === b.fontVariantCaps
  );
}

export function toRun(text: string, style: StyleState): StyledRun {
  const run: StyledRun = { text };
  if (style.bold) run.bold = true;
  if (style.italic) run.italic = true;
  if (style.fontWeight != null) run.fontWeight = style.fontWeight;
  if (style.fontSize != null) run.fontSize = style.fontSize;
  if (style.fontFamily != null) run.fontFamily = style.fontFamily;
  if (style.fillJson !== undefined) run.fill = JSON.parse(style.fillJson) as Fill | null;
  else if (style.color != null) run.fill = { paint: { kind: 'solid', color: style.color } };
  if (style.strokeJson !== undefined) run.stroke = JSON.parse(style.strokeJson) as Stroke;
  if (style.rotate != null) run.rotate = style.rotate;
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

