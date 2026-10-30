/**
 * Text as path geometry: the glyph outlines a text node draws, placed in
 * world space and composed into one `Path`. The glyphs are the ones
 * `layoutRuns` placed, so they land exactly where the renderer's outline tier
 * puts them, with the tier forced on for every glyph whatever its size.
 */

import type { Stroke, Fill } from '@weasel-js/paint';

import { loadFontOutlines, cachedFontVariant, type FontStyle } from '@weasel-js/font';
import {
  PATH_L, PATH_M, PATH_Z, coordsFrom, joinPaths, originFor, poseFrameOf, transformPath, type PathInWorldPose, type PolygonPath,
} from '@weasel-js/geom';
import {
  assertOutlinable, colorGlyphError, paintsOf, placedGlyphOutline,
} from './glyphOutlines';
import { lineDecorations } from './layout/decorationMetrics';
import { layoutRuns } from './layout/layoutRuns';
import { runFaces } from './layout/paintRuns';
import { textPoseLayoutInput, type TextPoseLayoutInput } from './layout/textPoseLayout';
import { verticalAlignOffset, type TextVerticalAlign } from './measure/verticalAlign';
import type { TextPose } from './pose';
import type { StyledRun } from './runs';
import type { ResolvedRun } from './runs/resolveRuns';
import type { TextStyle } from './textStyle';

export { TextOutlinesError, type TextOutlinesFailure } from './glyphOutlines';

/** The fields of a text node's data that decide its glyph geometry, and the
 *  paint `textToPathsByPaint` splits it by. Paint never changes the geometry. */
export interface TextOutlineSource {
  text: string;
  runs?: readonly StyledRun[];
  style?: TextStyle;
  verticalAlign?: TextVerticalAlign;
  /** The node's `data.fill`: `null` is no fill, absent the default black. */
  fill?: Fill | null;
  /** The node's `data.stroke`: absent or `null` is no stroke. */
  stroke?: Stroke | null;
}

/** One paint's share of a text node's outlines — see {@link textToPathsByPaint}. */
export interface TextPaintPath {
  /** The resolved fill these glyphs wear: the run's own, else the node's.
   *  `null` for unfilled text, painted by its stroke alone. */
  fill: Fill | null;
  /** The resolved stroke — the run's own, else the node's — or absent. */
  stroke?: Stroke;
  /** World-space outlines, as {@link textToPath} builds them. */
  path: PolygonPath;
}

/** A text node as {@link textToPath} reads it: its data and its pose. */
export interface TextNodeSource {
  data: TextOutlineSource;
  pose: PathInWorldPose;
}

/** Options for {@link textToPath}. */
export interface TextToPathOptions {
  /** The view scale a `{ px }` `fontSize` or `letterSpacing` resolves
   *  against, as for `textCommandFromPose`. Default 1. */
  scale?: number;
}

/** The face every run is set in, before and after variant resolution. */
function facesOf(runs: readonly ResolvedRun[]): { family: string; weight: number; style: FontStyle }[] {
  const out = new Map<string, { family: string; weight: number; style: FontStyle }>();
  const add = (family: string, weight: number, style: FontStyle) => {
    out.set(`${family}|${weight}|${style}`, { family, weight, style });
  };
  for (const r of runs) {
    add(r.fontFamily, r.fontWeight, r.fontStyle);
    const { family, weight, style } = cachedFontVariant(r.fontFamily, r.fontWeight, r.fontStyle).resolved;
    add(family, weight, style);
  }
  return [...out.values()];
}

/** The resolved runs and layout options of `data` set in `box`, every run's
 *  face checked for outlines first. */
export function outlineLayoutInput(
  data: TextOutlineSource,
  box: { x: number; y: number; width: number; height: number },
  opts: TextToPathOptions,
  caller: string,
): TextPoseLayoutInput {
  const textPose: TextPose = {
    x: box.x, y: box.y, width: box.width, height: box.height,
    text: data.text,
    runs: data.runs as StyledRun[] | undefined,
    style: data.style,
    verticalAlign: data.verticalAlign,
    fill: data.fill,
    stroke: data.stroke,
  };
  const input = textPoseLayoutInput(textPose, opts.scale ?? 1);
  for (const run of input.runs) assertOutlinable(run, caller);
  return input;
}

function ruleContour(x0: number, y0: number, x1: number, y1: number): PolygonPath {
  const xy = [x0, y0, x1, y0, x1, y1, x0, y1];
  const origin = originFor(xy);
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
    coords: coordsFrom(origin, xy),
    fillRule: 'nonzero',
    ...(origin ? { origin } : {}),
  };
}

/**
 * The one glyph walk behind both entry points: every placed glyph's outline
 * and every decoration rule, gathered by the paint its run wears. Paint
 * decides only which path a contour lands in, so an unfilled run's glyphs and
 * rules are geometry like any other.
 */
function walkOutlines(
  data: TextOutlineSource,
  pose: PathInWorldPose,
  opts: TextToPathOptions,
): { paints: { fill: Fill | null; stroke?: Stroke }[]; paths: PolygonPath[] } {
  const { runs, opts: layoutOpts } = outlineLayoutInput(data, pose, opts, 'textToPath');
  const { paints, paintOf } = paintsOf(runs);

  const laid = layoutRuns(runs, layoutOpts);
  const dx = pose.x;
  const dy = pose.y + verticalAlignOffset(data.verticalAlign, pose.height, laid.bounds.height);
  const parts: PolygonPath[][] = paints.map(() => []);
  const rules: PolygonPath[][] = paints.map(() => []);
  const faceOf = runFaces(runs);
  for (const line of laid.lines) {
    const deco = lineDecorations(runs, faceOf, (run) => String(paintOf[run]));
    for (const g of line.glyphs) {
      deco.add(g);
      // Asked before the quad: an emoji still waiting for its bake has none.
      if (g.glyph?.color) throw colorGlyphError(runs[g.run], 'textToPath');
      const glyph = placedGlyphOutline(g, dx, dy, 'textToPath');
      if (glyph) parts[paintOf[g.run]]!.push(glyph);
    }
    for (const r of deco.end()) {
      rules[paintOf[r.run]]!.push(ruleContour(r.x0 + dx, r.y0 + dy, r.x1 + dx, r.y1 + dy));
    }
  }

  const frame = poseFrameOf(pose);
  const paths = parts.map((glyphs, i) => {
    const path = joinPaths([...glyphs, ...rules[i]!]);
    if (!frame || path.commands.length === 0) return path;
    return transformPath(path, frame) as PolygonPath;
  });
  return { paints, paths };
}

/**
 * The outline geometry of a text node, in world space: every glyph and every
 * underline, strikethrough and overline rule it draws, as one `'nonzero'`
 * compound path whose filled region is their union. Glyphs keep the font's
 * curves; overlapping contours are not merged — run the result through
 * `pathUnion` for that, at the cost of flattening the curves.
 *
 * A glyph faked bold from a lighter face is grown by the distance the
 * renderer's field shift moves its edge, curves kept (`emboldenGlyph`).
 *
 * `pose` is the node's box, rotation, and `transform`. Throws
 * {@link TextOutlinesError} when any run's face cannot supply outlines — never
 * returns a partial or empty path for that. Text with no ink (empty, or only
 * spaces) returns an empty path.
 */
export function textToPath(
  data: TextOutlineSource,
  pose: PathInWorldPose,
  opts: TextToPathOptions = {},
): PolygonPath {
  return joinPaths(walkOutlines(data, pose, opts).paths);
}

/**
 * {@link textToPath}, split by paint: one path per distinct resolved fill and
 * stroke, each gathering the glyphs and decoration rules that wear it — a
 * rule takes the fill of the run it underlines. Groups come in the order
 * their paint first appears in the text; a paint whose runs put down no ink
 * has none. Paint resolves as the renderer resolves it. Throws as
 * `textToPath` does.
 */
export function textToPathsByPaint(
  data: TextOutlineSource,
  pose: PathInWorldPose,
  opts: TextToPathOptions = {},
): TextPaintPath[] {
  const { paints, paths } = walkOutlines(data, pose, opts);
  const out: TextPaintPath[] = [];
  paints.forEach((paint, i) => {
    if (paths[i]!.commands.length > 0) out.push({ ...paint, path: paths[i]! });
  });
  return out;
}

/**
 * Load the outlines of every face `data` is set in — the requested faces and
 * the ones they resolve to — so a following {@link textToPath} does not fail
 * with `'outlines-loading'`. Resolves once each has loaded or failed.
 */
export async function loadTextOutlines(
  data: TextOutlineSource,
  opts: TextToPathOptions = {},
): Promise<void> {
  const textPose: TextPose = {
    x: 0, y: 0, width: 0, height: 0,
    text: data.text,
    runs: data.runs as StyledRun[] | undefined,
    style: data.style,
  };
  const { runs } = textPoseLayoutInput(textPose, opts.scale ?? 1);
  await Promise.all(facesOf(runs).map((f) => loadFontOutlines(f.family, { weight: f.weight, style: f.style })));
  // An outline-only family resolves to its own face only once that face has
  // parsed; before, it resolved to whatever stood in. Ask again.
  await Promise.all(facesOf(runs).map((f) => loadFontOutlines(f.family, { weight: f.weight, style: f.style })));
}

