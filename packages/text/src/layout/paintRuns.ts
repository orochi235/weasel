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
  fillHasInk, paintKey, strokeHasInk, strokeKey, type Fill, type Stroke,
} from '@weasel-js/paint';
import type { ResolvedRun } from '../runs/resolveRuns';
import { lineDecorations, type DecorationKind } from './decorationMetrics';
import type { LaidOutRuns, PlacedGlyph } from './layoutRuns';

/** One textured glyph quad, relative to the text's own top-left. */
export interface LaidOutQuad {
  x0: number; y0: number; x1: number; y1: number;
  u0: number; v0: number; u1: number; v1: number;
  /** The glyph's baseline. The synthetic-italic skew leans vertices about it. */
  baselineY: number;
  /** On a `'color'` group's quads, the glyph's record, which a renderer drawing
   *  it larger than its bake asks for a sharper one (`sharperColorGlyph`). */
  colorGlyph?: BmFontChar;
}

/**
 * One glyph the renderer should tessellate rather than sample.
 *
 * `d` is em-space SVG path data — 1 unit is 1 em, y grows down, origin on the
 * baseline at the pen. Placing it is therefore a uniform scale by `scale`
 * followed by a translate to `(x, baselineY)`. `key` identifies the cached
 * tessellation — face identity plus codepoint.
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
  /** Gap between the request and the resolved match, for the renderer to fake. */
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
   *  (no registered outlines, synthetic bold) stays on the atlas, unstroked. */
  stroke?: Stroke;
  /** Textured glyph quads. Always empty for an `'outline'` group. */
  quads: LaidOutQuad[];
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
 * Em-space outline for `g`, or `null` to leave it on its SDF tier. Decided per
 * glyph, so a face the resolver reports as atlas or canvas can still serve it.
 */
export function glyphOutlineD(g: PlacedGlyph, run: ResolvedRun, minSize: number | undefined): string | null {
  if (g.glyph?.color) return null;
  const { family, weight, style } = g.resolved.resolved;
  // An outline-only run has no atlas behind it. Every gate below trades one
  // rendering for another; here there is no other, so gating would paint
  // nothing at all.
  if (g.resolved.source === 'outline') return glyphOutline(family, weight, style, g.cp);
  // A slot the layout left empty has no width to draw in: an outline there
  // would land on top of its neighbor.
  if (g.glyph === null) return null;
  if (minSize === undefined) return null;
  // A stroked run ignores the size gate: the SDF tiers have no geometry to
  // stroke, so leaving it below the threshold drops the outline asked for.
  // Gated on the run's size, so a small-caps word is not split across tiers.
  if (run.fontSize < minSize && !strokeHasInk(run.stroke)) return null;
  // Synthetic bold is an SDF threshold shift, and a path has no threshold.
  // Painting the regular weight instead would make text get *lighter* as
  // you zoom past the threshold. Synthetic italic is a shear, exact on
  // geometry, and the renderer applies it.
  if (g.resolved.synthetic.bold) return null;
  return glyphOutline(family, weight, style, g.cp);
}

/**
 * The atlas quad for `g`, or null when it has nothing to sample: no atlas
 * record, a zero-area glyph, or a dynamic glyph not baked yet.
 */
export function glyphQuad(g: PlacedGlyph): LaidOutQuad | null {
  const { font, glyph } = g;
  if (font === null || glyph === null || glyph.width === 0 || glyph.page < 0) return null;
  const scale = g.fontSize / g.metrics.size;
  const x0 = g.x + glyph.xoffset * scale;
  // `yoffset` is measured from the line top in the atlas's own frame, so
  // subtracting that frame's baseline hangs the glyph off its own.
  const y0 = g.baselineY + (glyph.yoffset - g.metrics.base) * scale;
  return {
    x0, y0, x1: x0 + glyph.width * scale, y1: y0 + glyph.height * scale,
    u0: glyph.x / font.common.scaleW,
    v0: glyph.y / font.common.scaleH,
    u1: (glyph.x + glyph.width) / font.common.scaleW,
    v1: (glyph.y + glyph.height) / font.common.scaleH,
    baselineY: g.baselineY,
  };
}

/** Each run's own face, which places its rules: a glyph's `resolved` may be a
 *  per-glyph fallback. */
export function runFaces(runs: readonly ResolvedRun[]): (run: number) => FaceMetrics | undefined {
  const faces = runs.map((r) => faceMetricsOf(resolveFontVariant(r.fontFamily, r.fontWeight, r.fontStyle)));
  return (run) => faces[run];
}

function groupFor(
  groups: Map<string, LaidOutGroup>,
  g: PlacedGlyph,
  run: ResolvedRun,
  source: LaidOutGroup['source'],
): LaidOutGroup {
  const { family, weight, style } = g.resolved.resolved;
  const { synthetic } = g.resolved;
  const page = source === 'outline' ? 0 : g.glyph!.page;
  // Only the outline tier can paint a stroke; an SDF group carrying one would
  // be a promise the renderer cannot keep.
  const stroke = source === 'outline' && strokeHasInk(run.stroke) ? run.stroke : undefined;
  const key = `${family}|${weight}|${style}|${synthetic.bold ? 1 : 0}${synthetic.italic ? 1 : 0}`
    + `|${paintKey(run.fill?.paint)}|${strokeKey(stroke)}|${source}|${page}`;
  let group = groups.get(key);
  if (!group) {
    group = {
      family, weight, style, synthetic: { ...synthetic }, source, page,
      fill: run.fill,
      ...(stroke ? { stroke } : {}),
      quads: [], glyphs: [],
    };
    groups.set(key, group);
  }
  return group;
}

/**
 * Derive what to draw for `laid`, the layout of `runs` — or of runs that
 * differ from them only in paint and decoration, which a layout does not read.
 */
export function paintRuns(
  laid: LaidOutRuns,
  runs: readonly ResolvedRun[],
  opts: PaintRunsOpts = {},
): PaintedRuns {
  const groups = new Map<string, LaidOutGroup>();
  const decorations: LaidOutDecoration[] = [];
  const faceOf = runFaces(runs);
  // A rule is a solid rect with only a fill to paint it.
  const rulePaint = (run: number): string | null =>
    (fillHasInk(runs[run].fill) ? paintKey(runs[run].fill!.paint) : null);

  for (const line of laid.lines) {
    for (const g of line.glyphs) {
      const run = runs[g.run];
      // Asked before the quad: a dynamic glyph still waiting for its bake has
      // no atlas rect, but its outline is available right now.
      const d = glyphOutlineD(g, run, opts.outlineMinSize);
      // An unfilled run paints through its stroke, and only tessellated
      // geometry can carry one. An atlas quad would paint the fill that was
      // refused, so it gets none.
      if (!fillHasInk(run.fill) && !(d !== null && strokeHasInk(run.stroke))) continue;
      if (d !== null) {
        const { family, weight, style } = g.resolved.resolved;
        groupFor(groups, g, run, 'outline').glyphs.push({
          d, key: `${family}|${weight}|${style}|${g.cp}`,
          x: g.x, baselineY: g.baselineY, scale: g.fontSize,
        });
        continue;
      }
      const quad = glyphQuad(g);
      if (!quad) continue;
      if (g.glyph?.color) groupFor(groups, g, run, 'color').quads.push({ ...quad, colorGlyph: g.glyph });
      else groupFor(groups, g, run, g.resolved.source).quads.push(quad);
    }
    for (const rule of lineDecorations(line.glyphs, runs, faceOf, rulePaint)) {
      const { run, ...rect } = rule;
      decorations.push({ ...rect, fill: runs[run].fill! });
    }
  }
  return { groups: [...groups.values()], decorations };
}
