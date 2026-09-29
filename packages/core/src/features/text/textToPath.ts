/**
 * Text as path geometry: the glyph outlines a text node draws, placed in
 * world space and composed into one `Path`. What "Create Outlines" replaces a
 * text node with, and what a Boolean op reads when a text node is an operand.
 *
 * The walk is `layoutRuns`', so the glyphs land exactly where the renderer's
 * outline tier puts them — same pen positions, same baselines, same synthetic
 * italic shear — but with the tier forced on for every glyph whatever its
 * size, and with paint set aside: unfilled text has outlines too.
 */

import {
  loadFontOutlines, outlineStatus, resolveFontVariant, type FontStyle,
} from '@weasel-js/font';
import {
  layoutRuns, textPoseLayoutInput, verticalAlignOffset,
  type ResolvedRun, type StyledRun, type TextPose, type TextStyle, type TextVerticalAlign,
} from '@weasel-js/text';
import {
  PATH_L, PATH_M, PATH_Z, pathFromD, pathSignedArea, reversePath, rotateAboutPoint,
  transformPath, type Mat3, type PolygonPath,
} from '@weasel-js/geom';
import { poseRotationOf } from 'core/geometry/poseRotation';
import type { PathInWorldPose } from 'features/paths/pathInWorld';
import { SYNTHETIC_ITALIC_RADIANS } from 'renderer/syntheticItalic';

/** The fields of a text node's data that decide its glyph geometry — the
 *  typography half of a `kit:text` node's `data`. Paint is not read. */
export interface TextOutlineSource {
  text: string;
  runs?: readonly StyledRun[];
  style?: TextStyle;
  verticalAlign?: TextVerticalAlign;
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
 * - `'synthetic-bold'` — the requested weight is faked from a lighter face.
 *   The renderer thickens the distance field for that, and a path has no
 *   field to thicken; emboldening geometry needs outline offsetting, which
 *   the kit does not have. Converting would silently lighten the text.
 */
export type TextOutlinesFailure =
  | 'no-outlines'
  | 'outlines-loading'
  | 'outlines-failed'
  | 'synthetic-bold';

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
  if (r.synthetic.bold) {
    fail('synthetic-bold', `drawn as a faux bold of ${family} ${weight}/${style}, which has no ` +
      'geometry to embolden. Register outlines for the real bold face.');
  }
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
 * The outline geometry of a text node, in world space: every glyph and every
 * underline, strikethrough and overline rule it draws, as one `'nonzero'`
 * compound path whose filled region is their union. Glyphs keep the font's
 * curves; overlapping contours are not merged — run the result through
 * `pathUnion` for that, at the cost of flattening the curves.
 *
 * `pose` is the node's box and rotation. Synthetic italic is sheared exactly
 * as the renderer shears it. Throws {@link TextOutlinesError} when any run's
 * face cannot supply outlines — never returns a partial or empty path for
 * that. Text with no ink (empty, or only spaces) returns an empty path.
 */
export function textToPath(
  data: TextOutlineSource,
  pose: PathInWorldPose,
  opts: TextToPathOptions = {},
): PolygonPath {
  const textPose: TextPose = {
    x: pose.x, y: pose.y, width: pose.width, height: pose.height,
    text: data.text,
    runs: data.runs as StyledRun[] | undefined,
    style: data.style,
    verticalAlign: data.verticalAlign,
  };
  const { runs, opts: layoutOpts } = textPoseLayoutInput(textPose, opts.scale ?? 1);
  for (const run of runs) assertOutlinable(run);

  // Paint never reaches the layout here — `textPose` carries none — so every
  // run is filled with the default and every glyph with ink is emitted.
  const laid = layoutRuns(runs, { ...layoutOpts, outlineMinSize: 0 });
  // A code point the run's own face lacks escalates to a fallback face, which
  // the per-run check above never saw.
  for (const g of laid.groups) {
    if (g.source !== 'outline' && g.quads.length > 0) {
      throw new TextOutlinesError('no-outlines', g.family, g.weight, g.style,
        'a fallback face serving some of the text\'s characters has no outlines registered.');
    }
  }

  const dx = pose.x;
  const dy = pose.y + verticalAlignOffset(data.verticalAlign, pose.height, laid.bounds.height);
  const parts: PolygonPath[] = [];
  for (const g of laid.groups) {
    const shear = g.synthetic.italic ? Math.tan(SYNTHETIC_ITALIC_RADIANS) : 0;
    for (const glyph of g.glyphs) {
      const s = glyph.scale;
      // The renderer's placement (`mergeGlyphMeshes`): x = pen + (ex - ey·shear)·s.
      const m: Mat3 = [s, 0, -shear * s, s, glyph.x + dx, glyph.baselineY + dy];
      parts.push(transformPath(emGlyph(glyph.d), m) as PolygonPath);
    }
  }
  for (const r of laid.decorations) {
    parts.push(ruleContour(r.x0 + dx, r.y0 + dy, r.x1 + dx, r.y1 + dy));
  }

  const path = concat(parts);
  const rot = poseRotationOf(pose);
  if (!rot || path.commands.length === 0) return path;
  return transformPath(path, rotateAboutPoint(rot.cx, rot.cy, rot.rotation)) as PolygonPath;
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

