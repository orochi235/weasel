/** Reading `<text>` and its `<tspan>` runs. */

import type { Matrix, SvgNode, SvgTextNode } from './types';
import {
  type StyledRun, type TextStyle, type TextPaint, layoutRuns, resolveRuns,
  resolveScreenLength, resolveTextStyle,
} from '@weasel-js/core';
import { multiply, parseTransform, isIdentity } from './transform';
import { anchorOffset } from './textAnchor';
import { placeNode } from './placeBox';
import { readLength } from './lengths';
import { DEFAULT_LINE_HEIGHT, LINE_HEIGHT_ATTR, LineTracker, writtenByWeasel } from './tspanLines';
import { LAID_ATTR } from './laidLines';
import { readRuns } from './readRuns';
import { inheritedLang } from './textLang';
import { mapFillPaint } from './fillPaint';
import { fillThroughMatrix } from './paintThroughMatrix';
import { scaleRuns, scaleStroke, scaleTextStyle } from './metricScale';
import type { GradientTable } from './gradients';
import {
  deriveStyle, ownValue, resolveCurrentColor, styleValue, type StyleContext,
} from './cascade';
import { readProperty } from './properties';
import { readStroke, isNonScalingStroke, coreStroke } from './readPaint';

/** Average glyph advance as a fraction of the em. Sans-serif Latin runs
 *  0.5–0.6; erring wide is the safer miss. */
const ESTIMATED_GLYPH_ADVANCE_EM = 0.6;

/**
 * Width of an external `<text>`'s longest line, through the same layout
 * `kit:text` paints with. With no registered font able to measure it, the
 * layout reports nothing, and the width is estimated from the em instead.
 */
function laidOutWidth(runs: readonly StyledRun[], style: TextStyle, plain: string): number {
  const resolved = resolveTextStyle(style);
  const { bounds } = layoutRuns(resolveRuns(runs.length > 0 ? runs : [{ text: plain }], resolved), {
    maxWidth: Infinity,
    lineHeight: resolved.lineHeight,
    align: resolved.align,
    direction: resolved.direction,
    tabSize: resolved.tabSize,
  });
  if (bounds.width > 0) return bounds.width;
  const longest = plain.split('\n').reduce((max, line) => Math.max(max, line.length), 0);
  return longest * resolved.fontSize * ESTIMATED_GLYPH_ADVANCE_EM;
}

/** A finite number attribute, or `undefined`. */
function numberAttr(el: Element, name: string): number | undefined {
  const n = parseFloat(el.getAttribute(name) ?? '');
  return Number.isFinite(n) ? n : undefined;
}

/** Take a text node built in its element's own coordinates through `m`,
 *  along with the lengths and user-space paints inside its box. */
function placeTextNode(node: SvgTextNode, m: Matrix, onWarn: (m: string) => void): void {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const scale = placeNode(node, 'text', m, false, onWarn);
  // Where the box's own contents went: the rotation rides `node.rotation`.
  const inBox: Matrix = [
    scale, 0, 0, scale,
    node.x + node.width / 2 - scale * cx, node.y + node.height / 2 - scale * cy,
  ];
  if (isIdentity(inBox)) return;
  if (Math.abs(scale - 1) > 1e-9) {
    node.style = scaleTextStyle(node.style, scale);
    if (node.runs) node.runs = scaleRuns(node.runs, scale);
    if (node.stroke) node.stroke = scaleStroke(node.stroke, scale);
  }
  if (node.fill) node.fill = mapFillPaint(node.fill, (p) => fillThroughMatrix(p, inBox));
  if (node.stroke?.paint) {
    node.stroke = { ...node.stroke, paint: fillThroughMatrix(node.stroke.paint, inBox) };
  }
  if (node.runs) {
    node.runs = node.runs.map((r) => (r.fill ? { ...r, fill: mapFillPaint(r.fill, (p) => fillThroughMatrix(p, inBox)) } : r));
  }
}

/**
 * Parse an SVG `<text>` element into an `SvgTextNode`. Reads geometry
 * from x/y plus optional `data-weasel-width` / `data-weasel-height`
 * (preserved across weasel→SVG round-trips); falls back to font-metric
 * estimates when those attrs are absent (external SVG sources).
 *
 * Child `<tspan>` elements with their own font/fill attrs become
 * `StyledRun`s on the node. Plain text without `<tspan>` produces no
 * `runs` and the node's `text` is the raw text content.
 */
export function parseTextElement(
  el: Element,
  ctm: Matrix,
  style: StyleContext,
  gradients: GradientTable,
  onWarn: (m: string) => void,
): SvgNode | null {
  const num = (raw: string | null, fallback: number): number => {
    if (raw == null) return fallback;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  };
  const localTransform = parseTransform(el.getAttribute('transform'), onWarn);
  // The box is built in the element's own coordinates and then taken through
  // the whole transform at once, by `placeNode`.
  const ax = readLength(el, 'x', 'x', 0, onWarn);
  const ay = readLength(el, 'y', 'y', 0, onWarn);

  const leafStyle = deriveStyle(style, el);
  const textStyle = readTextStyle(leafStyle, onWarn);
  const lang = inheritedLang(el);
  if (lang) textStyle.lang = lang;
  const textPaint = readTextPaint(leafStyle, gradients, onWarn, isNonScalingStroke(el));
  const fontSize = resolveScreenLength(textStyle.fontSize ?? 16, 1);

  const dominantBaseline = el.getAttribute('dominant-baseline');
  // Laid-out lines sit on their own baselines, and `y` stays the box top.
  const laid = el.hasAttribute(LAID_ATTR);
  const explicitTopAnchor = laid || dominantBaseline === 'text-before-edge'
    || dominantBaseline === 'hanging';
  // `baseline-shift` is legal and inheritable on <text> itself, and unlike
  // every other run key it has no node-level home to be read into — so a bare
  // text child would drop it. Seed those children with it instead; a <tspan>
  // naming its own still wins, as the SVG cascade says.
  const inheritedShift = ownValue(el, 'baseline-shift', onWarn) ?? {};

  const tracker = new LineTracker(el, onWarn);
  const { runs, lead } = readRuns(el, tracker, inheritedShift, textStyle, gradients, leafStyle, onWarn);
  const plain = runs.map((r) => r.text).join('');
  // If serialized by us, `y` is already the top edge. Otherwise SVG's
  // default is `y` = baseline of the first line — shift up by one
  // line of cap-height so weasel's box top approximates the cap-line.
  // Laid-out lines are placed under `y`; otherwise the first glyph's move
  // places the first line.
  const firstY = laid ? ay : tracker.firstBaseline ?? ay;
  const topY = explicitTopAnchor ? firstY : firstY - fontSize;
  const stated = numberAttr(el, LINE_HEIGHT_ATTR);
  const pitched = laid ? stated : tracker.lineHeight(fontSize, stated);
  if (pitched !== undefined) textStyle.lineHeight = pitched;
  const lineHeight = textStyle.lineHeight ?? DEFAULT_LINE_HEIGHT;

  // data-weasel-* attrs win; otherwise the box is what the text lays out to.
  const dataW = num(el.getAttribute('data-weasel-width'), NaN);
  const dataH = num(el.getAttribute('data-weasel-height'), NaN);
  const width = Number.isFinite(dataW) ? dataW : laidOutWidth(runs, textStyle, plain);
  // Newlines in the text drive line count for height estimation.
  const lines = (plain.match(/\n/g)?.length ?? 0) + 1;
  const height = Number.isFinite(dataH) ? dataH : fontSize * lineHeight * lines;

  const opacity = ownValue(el, 'opacity');
  const node: SvgTextNode = {
    kind: 'text',
    x: ax + lead - anchorOffset(textStyle, width, plain),
    y: topY,
    width,
    height,
    text: plain,
  };
  // Only attach `runs` when at least one run carries non-default styling —
  // single-run plain text is cleaner without it. `runsToPlainText(runs)`
  // must equal `text` per kit invariants, so the array must match exactly.
  //
  // "Any key but `text`" rather than an enumeration of the styling keys:
  // `readTspanRun` sets a field only when it parsed one, so the two are
  // equivalent, and the enumerated form silently dropped every run whose
  // only styling was a key added later — which is exactly how `stroke`
  // arrived and vanished.
  const hasStyling = runs.some(
    (r) => Object.entries(r).some(([k, v]) => k !== 'text' && v !== undefined),
  );
  if (hasStyling) node.runs = runs;
  // An absent `direction` is `ltr` in SVG and the text's own in this model, so
  // only text weasel wrote, which says `ltr` when it means it, keeps it absent.
  if (textStyle.direction === undefined && !writtenByWeasel(el)) {
    textStyle.direction = 'ltr';
  }
  if (el.getAttribute('data-weasel-wrap') === 'true') textStyle.wrap = true;
  if (el.getAttribute('data-weasel-align') === 'justify') textStyle.align = 'justify';
  const tabSize = Number(el.getAttribute('data-weasel-tab-size') ?? NaN);
  if (Number.isFinite(tabSize)) textStyle.tabSize = tabSize;
  const va = el.getAttribute('data-weasel-vertical-align');
  if (va === 'center' || va === 'bottom') node.verticalAlign = va;
  if (Object.keys(textStyle).length > 0) node.style = textStyle;
  // `!== undefined`, not `!= null`: `null` is the document saying `fill="none"`.
  if (textPaint.fill !== undefined) node.fill = textPaint.fill;
  if (textPaint.stroke != null) node.stroke = textPaint.stroke;
  if (opacity != null) node.opacity = opacity;
  placeTextNode(node, multiply(ctm, localTransform), onWarn);
  return node;
}

function readTextStyle(
  style: StyleContext,
  onWarn: (m: string) => void,
): TextStyle {
  const out: TextStyle = {};
  const size = styleValue(style, 'font-size', onWarn);
  if (size?.fontSize != null) out.fontSize = size.fontSize;
  const ff = styleValue(style, 'font-family', onWarn);
  if (ff) out.fontFamily = ff;
  const fw = styleValue(style, 'font-weight', onWarn);
  if (fw != null) out.fontWeight = fw;
  const fs = styleValue(style, 'font-style', onWarn);
  if (fs) out.fontStyle = fs;
  const direction = styleValue(style, 'direction');
  if (direction === 'rtl' || direction === 'ltr') out.direction = direction;
  // Read back as an absolute edge against the direction just parsed: SVG has
  // one relative pair where this model has a relative pair and an absolute
  // one, so the spelling cannot survive the trip — the rendered edge does.
  // SVG's initial `text-anchor` is `start`, which under `rtl` is the right
  // edge — while this model's default `align` is `left`. The two agree under
  // `ltr` and only there, so an absent anchor has to be written down when the
  // direction is what makes them disagree.
  const ltr = out.direction !== 'rtl';
  const anchor = styleValue(style, 'text-anchor') ?? (ltr ? undefined : 'start');
  if (anchor === 'start') out.align = ltr ? 'left' : 'right';
  else if (anchor === 'middle') out.align = 'center';
  else if (anchor === 'end') out.align = ltr ? 'right' : 'left';
  const ls = styleValue(style, 'letter-spacing', onWarn);
  if (ls != null) out.letterSpacing = ls;
  const decoration = styleValue(style, 'text-decoration', onWarn);
  if (decoration?.underline) out.underline = true;
  if (decoration?.strikethrough) out.strikethrough = true;
  if (decoration?.overline) out.overline = true;
  const transform = styleValue(style, 'text-transform', onWarn);
  if (transform && transform !== 'none') out.textTransform = transform;
  const variant = styleValue(style, 'font-variant', onWarn);
  if (variant === 'small-caps') out.fontVariantCaps = variant;
  // `lineHeight` is read from the lines' pitch and `data-weasel-line-height`
  // by the caller.
  // Edit-overlay-only chrome (`caretColor`, `selectionBackground`,
  // `selectionColor`) is intentionally not persisted — those are UI state,
  // not document content.
  return out;
}

/** Read a `<text>` element's glyph paint — the node's own fill and stroke,
 *  which are not typography and do not live in its `TextStyle`. */
function readTextPaint(
  style: StyleContext,
  gradients: GradientTable,
  onWarn: (m: string) => void,
  nonScalingStroke = false,
): TextPaint {
  const out: TextPaint = {};
  const fillRaw = resolveCurrentColor(style['fill'] ?? null, style);
  if (fillRaw) {
    const parsed = readProperty('fill', fillRaw);
    if (parsed?.kind === 'solid') {
      out.fill = { paint: { kind: 'solid', color: parsed.color } };
    } else if (parsed?.kind === 'ref') {
      const paint = gradients.get(parsed.id);
      if (paint) out.fill = { paint };
      else if (parsed.fallback) {
        out.fill = { paint: { kind: 'solid', color: parsed.fallback.color } };
      }
    } else if (parsed?.kind === 'none') {
      out.fill = null;
    }
  }
  // Text strokes used to be dropped here with a warning: an SDF glyph is a
  // sampled field, with no geometry to stroke. The outline tier gave large
  // text real contours, so a stroke is now a paint like any other — and one
  // that stays in the document even at sizes that render it unstroked.
  const stroke = coreStroke(readStroke(style, gradients, onWarn, nonScalingStroke));
  if (stroke) out.stroke = stroke;
  return out;
}
