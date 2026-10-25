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
import { emboldenGlyphD } from '../syntheticBold';
import { lineDecorations, type DecorationKind } from './decorationMetrics';
import { blankGlyph, doubles, lazy, LineBox } from './layoutColumns';
import type { LaidOutRuns, PlacedGlyph } from './layoutRuns';

/** One textured glyph quad, relative to the text's own top-left: what
 *  `LaidOutGroup.quads` holds, read out of `quadData`. */
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
   *  `LaidOutQuad`'s field order: `x0 y0 x1 y1 u0 v0 u1 v1 baselineY`. What
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
  const key = `${family}|${weight}|${style}|${g.cp}`;
  // Synthetic italic is a shear, exact on geometry, and the renderer applies
  // it. Synthetic bold is an SDF threshold shift, so the face's own outline
  // would be lighter: it is grown by the distance the shift moves the edge.
  if (outlineOnly || !g.resolved.synthetic.bold) return { d, key };
  const bold = emboldenGlyphD(d, g.resolved);
  return bold && { d: bold.d, key: `${key}|${bold.tag}` };
}

/**
 * Em-space outline of `g` in the face it resolved to, whichever tier draws it,
 * or `null` when it has none: a color glyph, or a slot the layout left empty,
 * which has no width to draw in and would land on top of its neighbor.
 */
export function faceOutlineD(g: PlacedGlyph): string | null {
  if (g.glyph?.color) return null;
  const { family, weight, style } = g.resolved.resolved;
  if (g.resolved.source !== 'outline' && g.glyph === null) return null;
  return glyphOutline(family, weight, style, g.cp);
}

/** Numbers per quad in `LaidOutGroup.quadData`. */
export const QUAD_STRIDE = 9;

/**
 * Whether `g` has an atlas quad: false with no atlas record, for a zero-area
 * glyph, or for a dynamic glyph not baked yet.
 */
export function hasGlyphQuad(g: PlacedGlyph): boolean {
  const { font, glyph } = g;
  return font !== null && glyph !== null && glyph.width !== 0 && glyph.page >= 0;
}

/** Write `g`'s atlas quad, which it must have, into `out` at `at`. */
function writeGlyphQuad(g: PlacedGlyph, out: number[], at: number): void {
  const font = g.font!, glyph = g.glyph!;
  const scale = g.fontSize / g.metrics.size;
  const x0 = g.x + glyph.xoffset * scale;
  // `yoffset` is measured from the line top in the atlas's own frame, so
  // subtracting that frame's baseline hangs the glyph off its own.
  const y0 = g.baselineY + (glyph.yoffset - g.metrics.base) * scale;
  out[at] = x0;
  out[at + 1] = y0;
  out[at + 2] = x0 + glyph.width * scale;
  out[at + 3] = y0 + glyph.height * scale;
  out[at + 4] = glyph.x / font.common.scaleW;
  out[at + 5] = glyph.y / font.common.scaleH;
  out[at + 6] = (glyph.x + glyph.width) / font.common.scaleW;
  out[at + 7] = (glyph.y + glyph.height) / font.common.scaleH;
  out[at + 8] = g.baselineY;
}

const groupViews: PropertyDescriptorMap = {
  quads: lazy('quads', (group: LaidOutGroup) => {
    const d = group.quadData;
    const out: LaidOutQuad[] = [];
    for (let at = 0, k = 0; at < d.length; at += QUAD_STRIDE, k++) {
      const q: LaidOutQuad = {
        x0: d[at], y0: d[at + 1], x1: d[at + 2], y1: d[at + 3],
        u0: d[at + 4], v0: d[at + 5], u1: d[at + 6], v1: d[at + 7], baselineY: d[at + 8],
      };
      if (group.colorGlyphs) q.colorGlyph = group.colorGlyphs[k];
      out.push(q);
    }
    return out;
  }),
};

/** Each run's own face, which places its rules: a glyph's `resolved` may be a
 *  per-glyph fallback. */
export function runFaces(runs: readonly ResolvedRun[]): (run: number) => FaceMetrics | undefined {
  const faces = runs.map((r) => faceMetricsOf(resolveFontVariant(r.fontFamily, r.fontWeight, r.fontStyle)));
  return (run) => faces[run];
}

/** The group the previous glyph joined, and every input its key was built from. */
interface LastGroup {
  group: LaidOutGroup | null;
  run: number; family: string; weight: number; style: FontStyle;
  bold: boolean; italic: boolean; source: LaidOutGroup['source']; page: number;
}

function groupFor(
  groups: Map<string, LaidOutGroup>,
  g: PlacedGlyph,
  run: ResolvedRun,
  source: LaidOutGroup['source'],
  last: LastGroup,
): LaidOutGroup {
  const { family, weight, style } = g.resolved.resolved;
  const { synthetic } = g.resolved;
  const page = source === 'outline' ? 0 : g.glyph!.page;
  // A glyph keyed like the one before it joins that group without building the
  // key, which, a string per glyph, was the largest allocation in painting text.
  if (last.group !== null && last.run === g.run && last.source === source && last.page === page
    && last.family === family && last.weight === weight && last.style === style
    && last.bold === synthetic.bold && last.italic === synthetic.italic) {
    return last.group;
  }
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
      quadData: [],
      ...(source === 'color' ? { colorGlyphs: [] } : {}),
      glyphs: [],
    } as unknown as LaidOutGroup;
    groups.set(key, group);
  }
  last.group = group;
  last.run = g.run; last.family = family; last.weight = weight; last.style = style;
  last.bold = synthetic.bold; last.italic = synthetic.italic; last.source = source; last.page = page;
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
  const last: LastGroup = {
    group: null, run: -1, family: '', weight: 0, style: 'normal', bold: false, italic: false, source: 'atlas', page: 0,
  };
  const decorations: LaidOutDecoration[] = [];
  const faceOf = runFaces(runs);
  // A rule is a solid rect with only a fill to paint it.
  const rulePaint = (run: number): string | null =>
    (fillHasInk(runs[run].fill) ? paintKey(runs[run].fill!.paint) : null);
  // One glyph walks the layout's columns, so painting builds no object a glyph.
  const cursor = blankGlyph();
  // Most text is one group. The first to take a quad gets an array sized for
  // every glyph, trimmed at the end; any other grows as it fills.
  let glyphCount = 0;
  for (const line of laid.lines) glyphCount += LineBox.span(line)?.count ?? line.glyphs.length;
  let sized: LaidOutGroup | null = null;
  let sizedAt = 0;

  for (const line of laid.lines) {
    const span = LineBox.span(line);
    const count = span ? span.count : line.glyphs.length;
    const rules = lineDecorations(runs, faceOf, rulePaint);
    for (let slot = 0; slot < count; slot++) {
      const g = span ? span.cols.glyph(span.start, span.cols.visual(span.start, slot), cursor) : line.glyphs[slot];
      rules.add(g);
      const run = runs[g.run];
      // Asked before the quad: a dynamic glyph still waiting for its bake has
      // no atlas rect, but its outline is available right now.
      const outline = glyphOutlineD(g, run, opts.outlineMinSize);
      // An unfilled run paints through its stroke, and only tessellated
      // geometry can carry one. An atlas quad would paint the fill that was
      // refused, so it gets none.
      if (!fillHasInk(run.fill) && !(outline !== null && strokeHasInk(run.stroke))) continue;
      if (outline !== null) {
        groupFor(groups, g, run, 'outline', last).glyphs.push({
          ...outline, x: g.x, baselineY: g.baselineY, scale: g.fontSize,
        });
        continue;
      }
      if (!hasGlyphQuad(g)) continue;
      const group = groupFor(groups, g, run, g.glyph!.color ? 'color' : g.resolved.source, last);
      if (sized === null) {
        sized = group;
        group.quadData = doubles(glyphCount * QUAD_STRIDE);
      }
      const quads = group.quadData as number[];
      if (group === sized) {
        writeGlyphQuad(g, quads, sizedAt);
        sizedAt += QUAD_STRIDE;
      } else {
        writeGlyphQuad(g, quads, quads.length);
      }
      (group.colorGlyphs as BmFontChar[] | undefined)?.push(g.glyph!);
    }
    for (const rule of rules.end()) {
      const { run, ...rect } = rule;
      decorations.push({ ...rect, fill: runs[run].fill! });
    }
  }
  if (sized !== null) (sized.quadData as number[]).length = sizedAt;
  const out: LaidOutGroup[] = [];
  for (const group of groups.values()) out.push(Object.defineProperties(group, groupViews));
  return { groups: out, decorations };
}
