/**
 * What to draw for laid-out text: which tier paints each glyph, which glyphs
 * can be staged together, and the decoration rules. Layout places the glyphs
 * and knows nothing of this; no decision here moves one.
 *
 * Underline, strikethrough and overline come out as solid rectangles built
 * from pen positions, not from quad extents: quads exist only for glyphs with
 * ink, so a decorated stretch's spaces would punch holes in a rule derived
 * from them.
 */
import {
  faceMetricsOf, glyphOutline, resolveFontVariant, type BmFontChar, type FaceMetrics, type FontStyle,
} from '@weasel-js/font';
import {
  fillHasInk, paintKey, strokeHasInk, type Fill, type Stroke,
} from '@weasel-js/paint';
import type { ResolvedRun } from '../runs/resolveRuns';
import { emboldenGlyphD } from '../syntheticBold';
import { lineDecorations, type DecorationKind } from './decorationMetrics';
import { doubles, takeDoubles } from './arrayPool';
import { blankGlyph, LineBox } from './layoutColumns';
import type { LaidOutRuns, PlacedGlyph } from './layoutRuns';
import { hasGlyphQuad, QUAD_STRIDE, writeGlyphQuad, type LaidOutQuad } from './glyphQuads';
import { groupFor, NO_QUADS, takeGroups } from './paintGroups';


/**
 * One glyph the renderer should tessellate rather than sample.
 *
 * `d` is em-space SVG path data — 1 unit is 1 em, y grows down, origin on the
 * baseline at the pen — with any synthetic bold already grown into it. Placing it is therefore a uniform scale by `scale`
 * followed by a translate to `(x, baselineY)`. `key` identifies the cached
 * tessellation — face identity plus codepoint, plus the growth of a synthetic
 * bold.
 */
export interface LaidOutOutlineGlyph {
  d: string;
  key: string;
  /** Pen position: where em-space x = 0 lands, in world units. */
  x: number;
  /** The glyph's baseline: where em-space y = 0 lands, in world units. */
  baselineY: number;
  /** World units per em — the glyph's `fontSize`, since em space is unit-scale. */
  scale: number;
  /** Degrees the glyph turns, clockwise about the pen, after any synthetic
   *  italic shear. Absent is upright. */
  rotate?: number;
}

/**
 * Glyphs that share a resolved face, glyph source and paint, so a renderer
 * can bind once for all of them. Groups come in the order their first glyph
 * appears, line by line in visual order, and paint in that order.
 */
export interface LaidOutGroup {
  /** Resolved atlas family — may differ from the requested family when the
   *  cross-family fallback policy substituted a default. A renderer looks the
   *  atlas up by this, exactly. */
  family: string;
  /** Resolved variant — matches the registered atlas and the texture-cache key. */
  weight: number;
  style: FontStyle;
  /** Gap between the request and the resolved match, for the renderer to fake.
   *  An `'outline'` group's bold is already grown into its glyphs. */
  synthetic: { bold: boolean; italic: boolean };
  /** Which glyph source this group binds: a baked MSDF atlas, the runtime
   *  canvas-SDF dynamic atlas, tessellated font outlines, or the dynamic
   *  atlas's color pages, whose quads are emoji painted in their own colors. */
  source: 'atlas' | 'canvas' | 'outline' | 'color';
  /** Dynamic-atlas page index for 'canvas' and 'color' groups, each in its
   *  own set of pages; 0 for the others. */
  page: number;
  /** The run's fill. It holds no paint — `null`, or a fill without one — only
   *  on an `'outline'` group carrying a stroke, since nothing else can put ink
   *  down without a fill. A `'color'` group takes its opacity and nothing else
   *  from it. */
  fill: Fill | null;
  /** Outline painted over the glyphs. Only ever set on an `'outline'` group —
   *  the SDF tiers have no geometry to stroke, which is why a stroke pulls its
   *  run onto the outline tier at any size. A run the tier cannot serve at all
   *  (no registered outlines) stays on the atlas, unstroked. */
  stroke?: Stroke;
  /** Textured glyph quads, {@link QUAD_STRIDE} numbers each, in
   *  `LaidOutQuad`'s field order: `x0 y0 x1 y1 u0 v0 u1 v1 baselineY penX rotate`. What
   *  a painter reads; `quads` is a view of it. Empty for an `'outline'` group. */
  quadData: readonly number[];
  /** On a `'color'` group, each quad's glyph record, which a renderer drawing
   *  it larger than its bake asks for a sharper one (`sharperColorGlyph`). */
  colorGlyphs?: readonly BmFontChar[];
  /** The same quads as objects, built on first read. */
  readonly quads: LaidOutQuad[];
  /** Outline geometry. Always empty for an `'atlas'` / `'canvas'` group. */
  glyphs: LaidOutOutlineGlyph[];
}

/**
 * One decoration rule: an axis-aligned solid rectangle in the same space as
 * `LaidOutQuad`. Never spans a line break, and carries the fill of the run(s)
 * it decorates so the rule follows the text color.
 */
export interface LaidOutDecoration {
  kind: DecorationKind;
  x0: number; y0: number; x1: number; y1: number;
  fill: Fill;
}

/** Options for {@link paintRuns}. */
export interface PaintRunsOpts {
  /**
   * World-space `fontSize` at or above which glyphs are emitted as outline
   * geometry, when the resolved face has outlines registered. Omit (the
   * default) to keep every glyph on its SDF tier.
   *
   * Ignored for a family that resolved to the outline tier because it has no
   * atlas: there the geometry is the only rendering.
   */
  outlineMinSize?: number;
}

/** What {@link paintRuns} returns. Relative to the text's own top-left, as the layout is. */
export interface PaintedRuns {
  groups: LaidOutGroup[];
  /** Decoration rules, in line order; within a stretch, underline then
   *  strikethrough then overline. Empty when nothing is decorated. */
  decorations: LaidOutDecoration[];
}

/**
 * Em-space outline for `g` and the key its tessellation is cached by, or
 * `null` to leave it on its SDF tier. Decided per glyph, so a face the
 * resolver reports as atlas or canvas can still serve it.
 */
export function glyphOutlineD(
  g: PlacedGlyph, run: ResolvedRun, minSize: number | undefined,
): { d: string; key: string } | null {
  // An outline-only run has no atlas behind it. Every gate below trades one
  // rendering for another; here there is no other, so gating would paint
  // nothing at all.
  const outlineOnly = g.resolved.source === 'outline';
  if (!outlineOnly) {
    if (minSize === undefined) return null;
    // A stroked run ignores the size gate: the SDF tiers have no geometry to
    // stroke, so leaving it below the threshold drops the outline asked for.
    // Gated on the run's size, so a small-caps word is not split across tiers.
    if (run.fontSize < minSize && !strokeHasInk(run.stroke)) return null;
  }
  const d = faceOutlineD(g);
  if (d === null) return null;
  const { family, weight, style } = g.resolved.resolved;
  const key = g.shaped ? `${family}|${weight}|${style}|#${g.shaped.key}` : `${family}|${weight}|${style}|${g.cp}`;
  // Synthetic italic is a shear, exact on geometry, and the renderer applies
  // it. Synthetic bold is an SDF threshold shift, so the face's own outline
  // would be lighter: it is grown by the distance the shift moves the edge.
  if (outlineOnly || !g.resolved.synthetic.bold) return { d, key };
  const bold = emboldenGlyphD(d, g.resolved);
  return bold && { d: bold.d, key: `${key}|${bold.tag}` };
}

/**
 * Em-space outline of `g` in the face it resolved to, whichever tier draws it
 * — its shaped cluster's, when its run was shaped — or `null` when it has none: a color glyph, or a slot the layout left empty,
 * which has no width to draw in and would land on top of its neighbor.
 */
export function faceOutlineD(g: PlacedGlyph): string | null {
  if (g.shaped) return g.shaped.d;
  if (g.glyph?.color) return null;
  const { family, weight, style } = g.resolved.resolved;
  if (g.resolved.source !== 'outline' && g.glyph === null) return null;
  return glyphOutline(family, weight, style, g.cp);
}

/** Each run's own face, which places its rules: a glyph's `resolved` may be a
 *  per-glyph fallback. */
export function runFaces(runs: readonly ResolvedRun[]): (run: number) => FaceMetrics | undefined {
  const faces = runs.map((r) => faceMetricsOf(resolveFontVariant(r.fontFamily, r.fontWeight, r.fontStyle)));
  return (run) => faces[run];
}

const isDecorated = (r: ResolvedRun): boolean => r.underline || r.strikethrough || r.overline;

/** One glyph walks a layout's columns, so painting builds no object a glyph,
 *  nor one a painting: each glyph is read before the next is filled in. */
const cursor = blankGlyph();

/** The first group's quads while a painting fills them, before they are
 *  copied out at their final length. */
let scratch: number[] = [];
/** Longest {@link scratch} grows to; a longer text's group gets its own. */
const SCRATCH_MAX = 1 << 14;

/**
 * Derive what to draw for `laid`, the layout of `runs` — or of runs that
 * differ from them only in paint and decoration, which a layout does not read.
 */
export function paintRuns(
  laid: LaidOutRuns,
  runs: readonly ResolvedRun[],
  opts: PaintRunsOpts = {},
): PaintedRuns {
  return paintRunsInto(laid, runs, opts, { groups: [], decorations: [] });
}

/** {@link paintRuns}, emptying `out`'s arrays and filling them. */
export function paintRunsInto(
  laid: LaidOutRuns,
  runs: readonly ResolvedRun[],
  opts: PaintRunsOpts,
  out: PaintedRuns,
): PaintedRuns {
  const { groups, decorations } = out;
  groups.length = 0;
  decorations.length = 0;
  const faceOf = runs.some(isDecorated) ? runFaces(runs) : null;
  // A rule is a solid rect with only a fill to paint it.
  const rulePaint = faceOf && ((run: number): string | null =>
    (fillHasInk(runs[run].fill) ? paintKey(runs[run].fill!.paint) : null));
  // Most text is one group. The first to take a quad fills a scratch array
  // sized for every glyph, copied out at its final length; any other grows
  // as it fills.
  let glyphCount = 0;
  const { lines } = laid;
  for (let i = 0; i < lines.length; i++) glyphCount += LineBox.count(lines[i]);
  const need = glyphCount * QUAD_STRIDE;
  if (need <= SCRATCH_MAX && scratch.length < need) scratch = doubles(need);
  const buf = need <= SCRATCH_MAX ? scratch : doubles(need);
  let sized: LaidOutGroup | null = null;
  let sizedAt = 0;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const cols = LineBox.columns(line);
    const start = cols !== null ? LineBox.start(line) : 0;
    const count = LineBox.count(line);
    const rules = faceOf && lineDecorations(runs, faceOf, rulePaint!);
    for (let slot = 0; slot < count; slot++) {
      const pos = cols !== null ? cols.visual(start, slot) : -1;
      const g = cols !== null ? cols.glyph(start, pos, cursor) : line.glyphs[slot];
      rules?.add(g);
      const run = runs[g.run];
      // A color cluster's leading code points draw no ink of their own, though
      // an outline face has a glyph for each: a keycap would paint its digit.
      const inks = cols !== null ? cols.drawsInk(start, pos) : line.cells[g.cell].drawsInk;
      // Asked before the quad: a dynamic glyph still waiting for its bake has
      // no atlas rect, but its outline is available right now.
      const outline = inks ? glyphOutlineD(g, run, opts.outlineMinSize) : null;
      // An unfilled run paints through its stroke, and only tessellated
      // geometry can carry one. An atlas quad would paint the fill that was
      // refused, so it gets none.
      if (!fillHasInk(run.fill) && !(outline !== null && strokeHasInk(run.stroke))) continue;
      if (outline !== null) {
        const placed: LaidOutOutlineGlyph = { ...outline, x: g.x, baselineY: g.baselineY, scale: g.fontSize };
        if (g.rotate) placed.rotate = g.rotate;
        groupFor(runs, g, 'outline').glyphs.push(placed);
        continue;
      }
      if (!hasGlyphQuad(g)) continue;
      const group = groupFor(runs, g, g.glyph!.color ? 'color' : g.resolved.source);
      if (sized === null) {
        sized = group;
        group.quadData = buf;
      }
      let quads = group.quadData as number[];
      if (quads === NO_QUADS) group.quadData = quads = [];
      if (group === sized) {
        writeGlyphQuad(g, quads, sizedAt);
        sizedAt += QUAD_STRIDE;
      } else {
        writeGlyphQuad(g, quads, quads.length);
      }
      (group.colorGlyphs as BmFontChar[] | undefined)?.push(g.glyph!);
    }
    if (!rules) continue;
    for (const rule of rules.end()) {
      const { run, ...rect } = rule;
      decorations.push({ ...rect, fill: runs[run].fill! });
    }
  }
  if (sized !== null && buf !== scratch) {
    buf.length = sizedAt;
  } else if (sized !== null) {
    const quads = takeDoubles(sizedAt);
    for (let k = 0; k < sizedAt; k++) quads[k] = scratch[k];
    sized.quadData = quads;
  }
  takeGroups(groups);
  return out;
}
