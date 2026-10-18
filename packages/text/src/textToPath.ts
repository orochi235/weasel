/**
 * Text as path geometry: the glyph outlines a text node draws, placed in
 * world space and composed into one `Path`. The glyphs are the ones
 * `layoutRuns` placed, so they land exactly where the renderer's outline tier
 * puts them, with the tier forced on for every glyph whatever its size.
 */

import { paintKey, strokeKey, type Stroke, type Fill } from '@weasel-js/paint';

import {
  loadFontOutlines, outlineStatus, resolveFontVariant, type FontStyle,
} from '@weasel-js/font';
import {
  PATH_L, PATH_M, PATH_Z, pathFromD, pathSignedArea, poseFrameOf, reversePath,
  transformPath, type Affine, type PathInWorldPose, type PolygonPath,
} from '@weasel-js/geom';
import { lineDecorations } from './layout/decorationMetrics';
import { layoutRuns } from './layout/layoutRuns';
import { faceOutlineD, glyphQuad, runFaces } from './layout/paintRuns';
import { textPoseLayoutInput } from './layout/textPoseLayout';
import { verticalAlignOffset, type TextVerticalAlign } from './measure/verticalAlign';
import type { TextPose } from './pose';
import type { StyledRun } from './runs';
import type { ResolvedRun } from './runs/resolveRuns';
import { SYNTHETIC_ITALIC_RADIANS } from './syntheticItalic';
import { emboldenGlyph } from './syntheticBold';
import type { TextStyle } from './textStyle';

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

/**
 * Why a text node has no outline geometry to give:
 *
 * - `'no-outlines'` — the face that serves it has no outlines registered
 *   (`registerFontOutlines`), so there is no geometry to read.
 * - `'outlines-loading'` — registered but not parsed yet. `loadTextOutlines`
 *   waits for it; the call has already started the load.
 * - `'outlines-failed'` — registered, and the bytes did not load or parse.
 * - `'color-glyph'` — the text holds an emoji, which is a picture in its own
 *   colors with no outline. Nothing a caller registers changes that.
 */
export type TextOutlinesFailure =
  | 'no-outlines'
  | 'color-glyph'
  | 'outlines-loading'
  | 'outlines-failed';

/** Thrown by {@link textToPath} when some run of the text has no outline
 *  geometry. Names the run's requested face. */
export class TextOutlinesError extends Error {
  readonly reason: TextOutlinesFailure;
  readonly family: string;
  readonly weight: number;
  readonly style: FontStyle;

  constructor(reason: TextOutlinesFailure, family: string, weight: number, style: FontStyle, detail: string) {
    super(`textToPath: "${family}" ${weight}/${style} — ${detail}`);
    this.name = 'TextOutlinesError';
    this.reason = reason;
    this.family = family;
    this.weight = weight;
    this.style = style;
  }
}

/** The face every run is set in, before and after variant resolution. */
function facesOf(runs: readonly ResolvedRun[]): { family: string; weight: number; style: FontStyle }[] {
  const out = new Map<string, { family: string; weight: number; style: FontStyle }>();
  const add = (family: string, weight: number, style: FontStyle) => {
    out.set(`${family}|${weight}|${style}`, { family, weight, style });
  };
  for (const r of runs) {
    add(r.fontFamily, r.fontWeight, r.fontStyle);
    const { family, weight, style } = resolveFontVariant(r.fontFamily, r.fontWeight, r.fontStyle).resolved;
    add(family, weight, style);
  }
  return [...out.values()];
}

function assertOutlinable(run: ResolvedRun): void {
  const { fontFamily, fontWeight, fontStyle } = run;
  const fail = (reason: TextOutlinesFailure, detail: string): never => {
    throw new TextOutlinesError(reason, fontFamily, fontWeight, fontStyle, detail);
  };
  const requested = outlineStatus(fontFamily, fontWeight, fontStyle);
  if (requested === 'idle' || requested === 'loading') {
    void loadFontOutlines(fontFamily, { weight: fontWeight, style: fontStyle });
    fail('outlines-loading', 'its outlines have not loaded yet; await loadTextOutlines first.');
  }
  const r = resolveFontVariant(fontFamily, fontWeight, fontStyle);
  const { family, weight, style } = r.resolved;
  if (r.source === 'outline') return;
  const status = outlineStatus(family, weight, style);
  if (status === null) {
    fail('no-outlines', `served by ${family} ${weight}/${style}, which has no outlines ` +
      'registered. Call registerFontOutlines for it.');
  }
  if (status === 'idle' || status === 'loading') {
    void loadFontOutlines(family, { weight, style });
    fail('outlines-loading', `the outlines of ${family} ${weight}/${style} have not loaded yet; ` +
      'await loadTextOutlines first.');
  }
  if (status === 'failed') {
    fail('outlines-failed', `the outlines registered for ${family} ${weight}/${style} failed to load.`);
  }
}

// Em-space glyph geometry, wound one way, keyed by the outline data itself so a
// re-registered face cannot serve stale geometry. The cap bounds a document
// that cycles through many faces.
const EM_CACHE_LIMIT = 4096;
const emCache = new Map<string, PolygonPath>();

/** A glyph's em-space path, wound positive so glyphs from faces that disagree
 *  on winding — TrueType against CFF — still fill their overlaps under
 *  `'nonzero'`, and so do the decoration rules drawn across them. */
function emGlyph(d: string): PolygonPath {
  let p = emCache.get(d);
  if (p) return p;
  p = pathFromD(d);
  if (pathSignedArea(p) < 0) p = reversePath(p);
  if (emCache.size >= EM_CACHE_LIMIT) emCache.clear();
  emCache.set(d, p);
  return p;
}

function concat(parts: readonly PolygonPath[]): PolygonPath {
  let nc = 0, nk = 0;
  for (const p of parts) { nc += p.commands.length; nk += p.coords.length; }
  const commands = new Uint8Array(nc);
  const coords = new Float32Array(nk);
  let ci = 0, ki = 0;
  for (const p of parts) {
    commands.set(p.commands, ci); ci += p.commands.length;
    coords.set(p.coords, ki); ki += p.coords.length;
  }
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

function ruleContour(x0: number, y0: number, x1: number, y1: number): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
    coords: new Float32Array([x0, y0, x1, y0, x1, y1, x0, y1]),
    fillRule: 'nonzero',
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
  const textPose: TextPose = {
    x: pose.x, y: pose.y, width: pose.width, height: pose.height,
    text: data.text,
    runs: data.runs as StyledRun[] | undefined,
    style: data.style,
    verticalAlign: data.verticalAlign,
    fill: data.fill,
    stroke: data.stroke,
  };
  const { runs, opts: layoutOpts } = textPoseLayoutInput(textPose, opts.scale ?? 1);
  for (const run of runs) assertOutlinable(run);

  const paints: { fill: Fill | null; stroke?: Stroke }[] = [];
  const indexOf = new Map<string, number>();
  const paintOf = runs.map((run): number => {
    const key = `${paintKey(run.fill?.paint)}|${strokeKey(run.stroke)}`;
    let i = indexOf.get(key);
    if (i === undefined) {
      i = paints.length;
      indexOf.set(key, i);
      paints.push(run.stroke !== undefined ? { fill: run.fill, stroke: run.stroke } : { fill: run.fill });
    }
    return i;
  });

  const laid = layoutRuns(runs, layoutOpts);
  const dx = pose.x;
  const dy = pose.y + verticalAlignOffset(data.verticalAlign, pose.height, laid.bounds.height);
  const parts: PolygonPath[][] = paints.map(() => []);
  const rules: PolygonPath[][] = paints.map(() => []);
  const faceOf = runFaces(runs);
  for (const line of laid.lines) {
    for (const g of line.glyphs) {
      // Asked before the quad: an emoji still waiting for its bake has none.
      if (g.glyph?.color) {
        const { fontFamily, fontWeight, fontStyle } = runs[g.run];
        throw new TextOutlinesError('color-glyph', fontFamily, fontWeight, fontStyle,
          'the text holds an emoji, which is drawn in its own colors and has no outline.');
      }
      const d = faceOutlineD(g);
      if (d === null) {
        // A code point the run's own face lacks escalates to a fallback face,
        // which the per-run check above never saw.
        if (glyphQuad(g) !== null) {
          const { family, weight, style } = g.resolved.resolved;
          throw new TextOutlinesError('no-outlines', family, weight, style,
            'a fallback face serving some of the text\'s characters has no outlines registered.');
        }
        continue;
      }
      const s = g.fontSize;
      const shear = g.resolved.synthetic.italic ? Math.tan(SYNTHETIC_ITALIC_RADIANS) : 0;
      // The renderer's placement (`mergeGlyphMeshes`): x = pen + (ex - ey·shear)·s.
      const m: Affine = [s, 0, -shear * s, s, g.x + dx, g.baselineY + dy];
      parts[paintOf[g.run]]!.push(transformPath(emboldenGlyph(emGlyph(d), d, g.resolved), m) as PolygonPath);
    }
    for (const r of lineDecorations(line.glyphs, runs, faceOf, (run) => String(paintOf[run]))) {
      rules[paintOf[r.run]]!.push(ruleContour(r.x0 + dx, r.y0 + dy, r.x1 + dx, r.y1 + dy));
    }
  }

  const frame = poseFrameOf(pose);
  const paths = parts.map((glyphs, i) => {
    const path = concat([...glyphs, ...rules[i]!]);
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
  return concat(walkOutlines(data, pose, opts).paths);
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

