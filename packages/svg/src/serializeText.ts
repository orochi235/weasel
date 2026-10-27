/** Writing `<text>` and its `<tspan>` runs. */

import { escapeAttr } from './xmlEscape';
import type { FontRequest, StyledRun, TextPoseLayout } from '@weasel-js/core';
import { halfLeadingFor, isSolidPaint, numericWeight, resolveRunFace, resolveScreenLength, resolveTextStyle, scriptMetricsFor } from '@weasel-js/core';
import { metaAttrsXml, metaElementsXml } from './metaXml';
import type { SvgTextNode } from './types';
import { trimNumber } from './transform';
import type { PaintServerRegistry } from './gradients';
import { anchorOffset, svgDirection } from './textAnchor';
import { boxTransformAttr } from './placeBox';
import { coreStrokeAttrs, opacityAttr, type Warn } from './strokeAttrs';
import { LINE_HEIGHT_ATTR, linesXml } from './tspanLines';
import { LAID_ATTR, laidLinesXml, layoutMeasured } from './laidLines';

/**
 * Emit a `<text>` element. `x` is the `text-anchor` point: the box's left
 * edge, center, or right edge as its alignment resolves.
 * `dominant-baseline="text-before-edge"` makes `y` the top of the box, and
 * the width and height, which SVG text doesn't model, go in `data-weasel-*`.
 * That sets the face's ascent on the box top, where weasel's layout puts half
 * the leading first, so a `dy` moves the lines down by it; weasel's reader
 * reads only `y`. A face nothing measured gets no `dy`.
 *
 * Given the node's `layout`, each line is written where it lays out instead
 * (`laidLinesXml`), and `y` stays the box top for weasel's own reader.
 */
export function textXml(
  node: SvgTextNode, registry: PaintServerRegistry, namespaces: Record<string, string>, warn: Warn,
  given?: TextPoseLayout | null,
): string {
  const layout = given && layoutMeasured(given, node.text) ? given : null;
  const resolved = resolveTextStyle(node.style);
  const x = node.x + anchorOffset(node.style, node.width, node.text);
  const leading = layout ? undefined : halfLeadingFor(
    resolved.fontFamily, numericWeight(resolved.fontWeight), resolved.fontStyle, resolved.fontSize, resolved.lineHeight,
  );
  const attrs: string[] = [
    `x="${trimNumber(x)}"`,
    `y="${trimNumber(node.y)}"`,
    layout ? `${LAID_ATTR}="lines"` : `dominant-baseline="text-before-edge"`,
    ...(leading ? [`dy="${trimNumber(leading)}"`] : []),
    // SVG's default whitespace handling would collapse indentation and runs
    // of spaces away on re-import.
    `xml:space="preserve"`,
    `data-weasel-width="${trimNumber(node.width)}"`,
    `data-weasel-height="${trimNumber(node.height)}"`,
  ];

  const style = node.style;
  // SVG user space has no camera, so a `{ px }` size writes as that many
  // user units — the reading it already has at scale 1.
  if (style?.fontSize != null) attrs.push(`font-size="${trimNumber(resolveScreenLength(style.fontSize, 1))}"`);
  if (style?.fontFamily) attrs.push(`font-family="${escapeAttr(style.fontFamily)}"`);
  if (style?.fontWeight != null) attrs.push(`font-weight="${escapeAttr(String(style.fontWeight))}"`);
  if (style?.fontStyle && style.fontStyle !== 'normal') attrs.push(`font-style="${style.fontStyle}"`);
  if (style?.fontVariantCaps === 'small-caps') attrs.push('font-variant="small-caps"');
  const direction = svgDirection(style, node.text);
  // A stated `ltr` is written too: absent reads back as the text's own direction.
  if (direction === 'rtl' || style?.direction === 'ltr') attrs.push(`direction="${direction}"`);
  let anchor: 'start' | 'middle' | 'end' = 'start';
  if (style?.align != null || direction === 'rtl') {
    // `text-anchor` is reading-order relative in SVG exactly as `start` / `end`
    // are here, so only the absolute pair has to be turned into an edge the
    // reader resolves the same way.
    const align = style?.align ?? 'left';
    // SVG text does not wrap, so `text-anchor` has no justify: a justified
    // node is anchored at its start edge, with each laid-out word placed by
    // its own `x`. `data-weasel-align` keeps the justification for weasel.
    anchor = align === 'center' ? 'middle'
      : align === 'start' || align === 'justify' ? 'start'
      : align === 'end' ? 'end'
      : (align === 'left') === (direction === 'ltr') ? 'start' : 'end';
    if (anchor !== 'start') attrs.push(`text-anchor="${anchor}"`);
    if (align === 'justify') attrs.push('data-weasel-align="justify"');
  }
  if (style?.letterSpacing != null && style.letterSpacing !== 0) {
    attrs.push(`letter-spacing="${trimNumber(resolveScreenLength(style.letterSpacing, 1))}"`);
  }
  const decoration = textDecorationValue(style?.underline, style?.strikethrough, style?.overline);
  if (decoration) attrs.push(`text-decoration="${decoration}"`);
  if (style?.script) attrs.push(`baseline-shift="${style.script}"`);
  // A CSS property rather than an SVG 1.1 presentation attribute, so it goes
  // where every CSS-aware reader looks for it.
  if (style?.textTransform && style.textTransform !== 'none') {
    attrs.push(`style="text-transform:${style.textTransform}"`);
  }
  // SVG text never wraps, so this is for weasel's own reader, beside the box
  // width it wraps at.
  if (style?.wrap) {
    attrs.push('data-weasel-wrap="true"');
    if (!layout) warn('text that wraps at its box width is written unwrapped: SVG text does not wrap, so other'
      + ' readers draw one line per hard break (weasel reads the wrap back)');
  }
  if (style?.tabSize != null) attrs.push(`data-weasel-tab-size="${trimNumber(style.tabSize)}"`);
  if (node.verticalAlign && node.verticalAlign !== 'top') {
    attrs.push(`data-weasel-vertical-align="${node.verticalAlign}"`);
    if (!layout) warn(`text aligned to the ${node.verticalAlign} of its box is written top-aligned: SVG text has`
      + ' no box, so other readers draw it at the top (weasel reads the alignment back)');
  }
  // The lines' `dy` shows the pitch to every reader, but a single line has
  // none, and laid-out lines are pitched by their tallest run.
  if (style?.lineHeight != null) attrs.push(`${LINE_HEIGHT_ATTR}="${trimNumber(style.lineHeight)}"`);
  if (node.fill !== undefined) {
    const paint = node.fill?.paint;
    if (!paint) attrs.push('fill="none"');
    else {
      attrs.push(`fill="${isSolidPaint(paint) ? escapeAttr(paint.color) : registry.ref(paint)}"`);
      attrs.push(...opacityAttr('fill-opacity', paint.opacity));
    }
  }
  for (const a of coreStrokeAttrs(node.stroke, registry, warn)) attrs.push(a);
  if (node.opacity != null && node.opacity !== 1) {
    attrs.push(`opacity="${trimNumber(node.opacity)}"`);
  }
  const frame = boxTransformAttr(node);
  if (frame) attrs.push(frame);

  const pieces = node.runs && node.runs.length > 0
    ? node.runs.map((r) => ({ text: r.text, attrs: runAttrs(r, style, registry, warn) }))
    : [{ text: node.text, attrs: null }];
  const body = layout
    ? laidLinesXml(pieces, layout, { anchor, rtl: direction === 'rtl' })
    : linesXml(pieces, x, resolved.fontSize * resolved.lineHeight);
  const metaAttrs = metaAttrsXml(node.meta, namespaces);
  const metaEls = metaElementsXml(node.meta, namespaces);
  return `<text ${attrs.join(' ')}${metaAttrs}>${body}${metaEls}</text>`;
}

/**
 * The face whose metrics size `run`'s script, for a run that overrode only
 * the rise and so must spell the preset's size out. `undefined` for every
 * other run.
 */
export function scriptSizeFace(
  run: StyledRun, style: SvgTextNode['style'],
): Required<FontRequest> | undefined {
  if (run.script == null || run.baselineShift == null) return undefined;
  const face = resolveRunFace(run, resolveTextStyle(style));
  return { family: face.fontFamily, weight: face.fontWeight, style: face.fontStyle };
}

/** The attributes of the `<tspan>` a run is written as. */
function runAttrs(
  run: StyledRun,
  style: SvgTextNode['style'],
  registry: PaintServerRegistry,
  warn: Warn,
): string[] {
  const attrs: string[] = [];
  if (run.fontWeight != null) attrs.push(`font-weight="${run.fontWeight}"`);
  else if (run.bold) attrs.push(`font-weight="700"`);
  if (run.italic) attrs.push(`font-style="italic"`);
  // `normal` included: on a run it overrides small caps the node passes down.
  if (run.fontVariantCaps) attrs.push(`font-variant="${run.fontVariantCaps}"`);
  if (run.fontFamily) attrs.push(`font-family="${escapeAttr(run.fontFamily)}"`);
  // A percentage `font-size` is relative to the parent's, which is what
  // `fontScale` means; an absolute `fontSize` wins over it.
  //
  // `baseline-shift="super"` carries the preset's *size* as well as its rise,
  // so a run that overrode only the rise must spell the size out, or the
  // superscript comes back full-size at a raised baseline.
  const face = scriptSizeFace(run, style);
  const presetScale = face && run.script
    ? scriptMetricsFor(face.family, face.weight, face.style)[run.script].size
    : undefined;
  const scale = run.fontScale ?? presetScale;
  if (run.fontSize != null) attrs.push(`font-size="${trimNumber(resolveScreenLength(run.fontSize, 1))}"`);
  else if (scale != null) attrs.push(`font-size="${trimNumber(scale * 100)}%"`);
  // Same story for `baseline-shift`: an SVG percentage resolves against the
  // parent's font size, which is the unit `baselineShift` is already in.
  if (run.baselineShift != null) {
    attrs.push(`baseline-shift="${trimNumber(run.baselineShift * 100)}%"`);
  } else if (run.script) {
    attrs.push(`baseline-shift="${run.script}"`);
  }
  // Unlike at node level, a run-level `0` is an override, not "inherit the
  // node's letterSpacing", so it is emitted whenever set.
  if (run.letterSpacing != null) {
    attrs.push(`letter-spacing="${trimNumber(resolveScreenLength(run.letterSpacing, 1))}"`);
  }
  const runDecoration = textDecorationValue(run.underline, run.strikethrough, run.overline);
  if (runDecoration) attrs.push(`text-decoration="${runDecoration}"`);
  if (run.fill !== undefined) {
    const paint = run.fill?.paint;
    if (!paint) attrs.push('fill="none"');
    else if (isSolidPaint(paint)) attrs.push(`fill="${escapeAttr(paint.color)}"`);
    else attrs.push(`fill="${registry.ref(paint)}"`);
  }
  for (const a of coreStrokeAttrs(run.stroke, registry, warn)) attrs.push(a);
  // `none` included: on a run it overrides a transform the node would pass down.
  if (run.textTransform) attrs.push(`style="text-transform:${run.textTransform}"`);
  // One value turns every glyph of the tspan: a glyph past a list's end takes its last.
  if (run.rotate) attrs.push(`rotate="${trimNumber(run.rotate)}"`);
  return attrs;
}

/** The flags as an SVG `text-decoration` value, or `null` when none is set. */
function textDecorationValue(
  underline: boolean | undefined,
  strikethrough: boolean | undefined,
  overline: boolean | undefined,
): string | null {
  const tokens: string[] = [];
  if (underline) tokens.push('underline');
  if (strikethrough) tokens.push('line-through');
  if (overline) tokens.push('overline');
  return tokens.length > 0 ? tokens.join(' ') : null;
}
