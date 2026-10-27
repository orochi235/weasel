import { isSolidPaint } from '@weasel-js/paint';
import { cssFontFamily, isCanvasFont } from '@weasel-js/font';
import { fontString, numericWeight, smallCapsScaleFor, type ResolvedTextStyle } from '@weasel-js/text';
import { SMALL_CAPS_SCALE_PROPERTY } from './domRuns';
import { applyOverlayDirection } from './overlayDirection';

/** Dress the edit overlay in the node's resolved style, so it looks like the
 *  canvas the moment editing starts. */
export function applyOverlayStyle(el: HTMLDivElement, style: ResolvedTextStyle): void {
  el.style.position = 'absolute';
  el.style.pointerEvents = 'auto';
  el.style.boxSizing = 'border-box';
  el.style.margin = '0';
  el.style.padding = '0';
  el.style.border = '0';
  el.style.outline = 'none';
  el.style.background = 'transparent';
  // Unfilled text still edits in black: the overlay has to be legible, and
  // there is no CSS spelling of "no fill" that leaves the glyphs visible.
  const paint = style.fill?.paint;
  el.style.color = isSolidPaint(paint) ? paint.color : '#000';
  el.style.caretColor = style.caretColor;
  // The canvas's face, not the browser's reading of the family name.
  const fontFamily = cssFontFamily(style.fontFamily, {
    weight: numericWeight(style.fontWeight), style: style.fontStyle,
  });
  el.style.font = fontString({ ...style, fontFamily });
  // Linux Chromium otherwise rounds every advance to a whole pixel at DPR 1, while
  // the canvas lays out a face's own fractional ones: 'Small Caps' at 24px ran 3px
  // long. A canvas font is measured by the browser's default rendering, so keeps it.
  el.style.textRendering = isCanvasFont(style.fontFamily) ? '' : 'geometricPrecision';
  el.style.lineHeight = String(style.lineHeight);
  applyOverlayDirection(el, style);
  // The browser's CSS `text-transform` and its spell checker read it.
  if (style.lang) el.lang = style.lang;
  else el.removeAttribute('lang');
  const decorations: string[] = [];
  if (style.underline) decorations.push('underline');
  if (style.strikethrough) decorations.push('line-through');
  if (style.overline) decorations.push('overline');
  el.style.textDecoration = decorations.length > 0 ? decorations.join(' ') : 'none';
  el.style.textTransform = style.textTransform;
  // The CSS spelling for what a browser reads; the scale for the pieces
  // `runsToDom` splits inheriting runs into, so they match the canvas.
  el.style.fontVariant = style.fontVariantCaps;
  el.style.setProperty(
    SMALL_CAPS_SCALE_PROPERTY,
    style.fontVariantCaps === 'small-caps'
      ? String(smallCapsScaleFor(style.fontFamily, numericWeight(style.fontWeight), style.fontStyle))
      : '',
  );
  // Line breaks follow the node's declared `wrap`, as the canvas's do. Layout
  // breaks only between words, never inside one.
  el.style.whiteSpace = style.wrap ? 'pre-wrap' : 'pre';
  el.style.overflowWrap = 'normal';
  el.style.wordBreak = 'normal';
}
