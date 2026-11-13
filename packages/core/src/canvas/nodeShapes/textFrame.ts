/**
 * What a text node with a `background` draws around its box: an edge in a
 * shade of the background, and a shadow under it. Described once here, and
 * drawn by the canvas painter and written by the SVG export from it.
 */
import { isSolidPaint, mixOklab, parseColor, resolveFill, rgbaToHex, type Fill } from '@weasel-js/paint';
import { dropShadowLayers } from '@weasel-js/renderer';
import type { Path, Rect } from '@weasel-js/geom';

/** A rule just inside a text node's box, in its background's color mixed toward black. */
export interface TextEdge {
  /** World units. */
  width: number;
  /** How far toward black, 0..1, mixed in OKLab, so the edge keeps the background's hue. */
  shade: number;
}

/** The shadow a text node's background casts: black at `alpha`, offset and blurred in world units. */
export interface TextShadow {
  x: number;
  y: number;
  blur: number;
  alpha: number;
}

/** A text node's frame, ready to draw: each part `null` when there is none. */
export interface TextFrame {
  /** Filled in `color`, each at `opacity`, under the background. */
  shadow: { paths: Path[]; color: string; opacity: number } | null;
  /** Stroked in `color` at `width`, over the background. */
  edge: { path: Path; color: string; width: number } | null;
}

type Box = { x: number; y: number; width: number; height: number };

const BLACK = [0, 0, 0, 1] as const;

/** `background`'s color mixed `shade` of the way to black, or `null` for a background with no single color. */
export function edgeColor(background: Fill, shade: number): string | null {
  const paint = background.paint;
  if (paint === undefined || !isSolidPaint(paint)) return null;
  return rgbaToHex(mixOklab(BLACK, parseColor(paint.color), Math.min(1, Math.max(0, shade))));
}

/** The frame of a text node with `d`'s background, edge and shadow, round `box`. */
export function textFrameOf(
  d: { background?: Fill | null; edge?: TextEdge; shadow?: TextShadow },
  box: Box,
): TextFrame {
  const bg = resolveFill(d.background);
  if (!bg) return { shadow: null, edge: null };
  return { shadow: shadowOf(d.shadow, box), edge: edgeOf(d.edge, bg, box) };
}

function shadowOf(s: TextShadow | undefined, box: Box): TextFrame['shadow'] {
  if (!s || !(s.alpha > 0)) return null;
  const { paths, alpha } = dropShadowLayers(box, 0, s);
  return { paths, color: rgbaToHex([0, 0, 0, Math.min(1, s.alpha)]), opacity: alpha };
}

function edgeOf(edge: TextEdge | undefined, bg: Fill, box: Box): TextFrame['edge'] {
  if (!edge || !(edge.width > 0)) return null;
  const color = edgeColor(bg, edge.shade);
  if (color === null) return null;
  const w = Math.min(edge.width, box.width / 2, box.height / 2);
  return {
    path: { kind: 'rect', x: box.x + w / 2, y: box.y + w / 2, width: box.width - w, height: box.height - w },
    color,
    width: w,
  };
}

/** How far a text node's shadow reaches, as a box, or `null` for none. */
export function textShadowBox(d: { background?: Fill | null; shadow?: TextShadow }, box: Box): Rect | null {
  const s = d.shadow;
  if (!s || !(s.alpha > 0) || !resolveFill(d.background)) return null;
  const e = Math.max(0, s.blur) / 2;
  return { x: box.x + s.x - e, y: box.y + s.y - e, width: box.width + 2 * e, height: box.height + 2 * e };
}
