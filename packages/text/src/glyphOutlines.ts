/**
 * The per-glyph half of text-as-geometry, shared by `textToPath` and
 * `textClusters`: checking a run's face can give outlines, finding a placed
 * glyph's outline, and setting it where the renderer's outline tier puts it.
 */
import { paintKey, strokeKey, type Stroke, type Fill } from '@weasel-js/paint';
import { loadFontOutlines, outlineStatus, resolveFontVariant, type FontStyle } from '@weasel-js/font';
import { pathFromD, pathSignedArea, reversePath, transformPath, type Affine, type PolygonPath } from '@weasel-js/geom';
import type { PlacedGlyph } from './layout/layoutRuns';
import { faceOutlineD, glyphQuad } from './layout/paintRuns';
import type { ResolvedRun } from './runs/resolveRuns';
import { SYNTHETIC_ITALIC_RADIANS } from './syntheticItalic';
import { emboldenGlyph } from './syntheticBold';

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

/** Thrown by `textToPath`, `textToPathsByPaint` and `textClusters` when some
 *  run of the text has no outline geometry. Names the run's requested face and
 *  the function that was asked. */
export class TextOutlinesError extends Error {
  readonly reason: TextOutlinesFailure;
  readonly family: string;
  readonly weight: number;
  readonly style: FontStyle;

  constructor(
    reason: TextOutlinesFailure, family: string, weight: number, style: FontStyle, detail: string,
    caller = 'textToPath',
  ) {
    super(`${caller}: "${family}" ${weight}/${style} — ${detail}`);
    this.name = 'TextOutlinesError';
    this.reason = reason;
    this.family = family;
    this.weight = weight;
    this.style = style;
  }
}

/** Throws {@link TextOutlinesError} for `caller` unless `run`'s face has outlines loaded. */
export function assertOutlinable(run: ResolvedRun, caller: string): void {
  const { fontFamily, fontWeight, fontStyle } = run;
  const fail = (reason: TextOutlinesFailure, detail: string): never => {
    throw new TextOutlinesError(reason, fontFamily, fontWeight, fontStyle, detail, caller);
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

/** The distinct paints `runs` wear, keyed on fill and stroke together, in the
 *  order they first appear, and which of them each run wears. */
export function paintsOf(runs: readonly ResolvedRun[]): {
  paints: { fill: Fill | null; stroke?: Stroke }[];
  paintOf: number[];
} {
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
  return { paints, paintOf };
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

/**
 * The outline of `g`, a glyph that is not a color glyph, with its pen at
 * `(g.x + dx, g.baselineY + dy)`; `null` for a slot with nothing to draw.
 * Throws for `caller` when a fallback face drew it, which the per-run check
 * never saw.
 */
export function placedGlyphOutline(
  g: PlacedGlyph, dx: number, dy: number, caller: string,
): PolygonPath | null {
  const d = faceOutlineD(g);
  if (d === null) {
    if (glyphQuad(g) !== null) {
      const { family, weight, style } = g.resolved.resolved;
      throw new TextOutlinesError('no-outlines', family, weight, style,
        'a fallback face serving some of the text\'s characters has no outlines registered.', caller);
    }
    return null;
  }
  const s = g.fontSize;
  const shear = g.resolved.synthetic.italic ? Math.tan(SYNTHETIC_ITALIC_RADIANS) : 0;
  // The renderer's placement (`mergeGlyphMeshes`): x = pen + (ex - ey·shear)·s.
  const m: Affine = [s, 0, -shear * s, s, g.x + dx, g.baselineY + dy];
  return transformPath(emboldenGlyph(emGlyph(d), d, g.resolved), m) as PolygonPath;
}

/** The `'color-glyph'` {@link TextOutlinesError} for a glyph of `run`, thrown by `caller`. */
export function colorGlyphError(run: ResolvedRun, caller: string): TextOutlinesError {
  return new TextOutlinesError('color-glyph', run.fontFamily, run.fontWeight, run.fontStyle,
    'the text holds an emoji, which is drawn in its own colors and has no outline.', caller);
}

/** `parts` as one `'nonzero'` compound path. */
export function concat(parts: readonly PolygonPath[]): PolygonPath {
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
