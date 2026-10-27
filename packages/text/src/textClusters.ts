/**
 * A text line as its grapheme clusters, each one's outlines set at its own
 * origin with the slot it takes on the line — the pieces a caller lays out
 * one by one, as text along a path does.
 */
import { faceMetricsOf, glyphGeneration } from '@weasel-js/font';
import { joinPaths, type PolygonPath } from '@weasel-js/geom';
import type { Fill, Stroke } from '@weasel-js/paint';
import { paintsOf, placedGlyphOutline } from './glyphOutlines';
import { lineDecorations, type DecorationKind } from './layout/decorationMetrics';
import { layoutRuns, type PlacedGlyph } from './layout/layoutRuns';
import { runFaces } from './layout/paintRuns';
import {
  outlineLayoutInput, type TextOutlineSource, type TextPaintPath, type TextToPathOptions,
} from './textToPath';

/** One grapheme cluster of a text line: its slot and its outlines. */
export interface TextCluster {
  /** Its slot's leading edge, from the line's left, in visual order. */
  x: number;
  /** The slot's width: its cells' advances, kerning and tracking included. */
  advance: number;
  /** Outlines with the slot's left edge at x = 0 and the baseline at y = 0, y down, one per paint; empty for a
   *  space or a color glyph. */
  paths: TextPaintPath[];
  /** Height of the x-height's middle above the baseline. */
  middle: number;
  /** The decoration rules crossing the slot, cut to it, in the frame `paths` use; underline, then strikethrough, then
   *  overline. A rule running on into the next slot ends at `advance` here and starts at 0 there. */
  rules: TextClusterRule[];
}

/** The stretch of one decoration rule inside a cluster's slot. */
export interface TextClusterRule {
  kind: DecorationKind;
  /** Its ends along the slot, 0..`advance`. */
  x0: number;
  x1: number;
  /** Its top and bottom edges, y down from the baseline. */
  y0: number;
  y1: number;
  /** The paint its run wears, as the cluster's `paths` carry it. */
  fill: Fill | null;
  stroke?: Stroke;
}

/** Options for {@link textClusters}. */
export interface TextClustersOptions extends TextToPathOptions {
  /** The node's box width, which a `wrap` style wraps at and `align` aligns
   *  in, as the node's own layout does. Default `Infinity`: one line per
   *  paragraph. */
  width?: number;
}

// Where a face reports no x-height: half of a typical 0.5 em one.
const MIDDLE_FALLBACK = 0.25;

/**
 * The first laid line of `data` as its grapheme clusters, in visual order,
 * laid at the node's box origin with no pose applied; the lines after it are
 * dropped. The slots tile the
 * line: each cluster's `advance` runs to the next one's `x`, so the kerning
 * between two clusters belongs to the left one. A decoration rule is cut into
 * the slots it crosses (`rules`).
 *
 * Throws `TextOutlinesError` as `textToPath` does, except that a color
 * glyph, or one drawn by a fallback face with no outlines, keeps its slot
 * with no `paths`. Only a code point that inks its slot is drawn, so a color
 * cluster's leading code points stay blank too.
 *
 * Remembered per `data` object: the same `data`, `width` and `scale` hand
 * back the same array until a face or glyph changes, so treat `data` as
 * immutable and don't mutate the result. A throw is not remembered.
 */
export function textClusters(data: TextOutlineSource, opts: TextClustersOptions = {}): TextCluster[] {
  const width = opts.width ?? Infinity;
  const scale = opts.scale ?? 1;
  const generation = glyphGeneration();
  const hit = remembered.get(data);
  if (hit && hit.width === width && hit.scale === scale && hit.generation === generation) return hit.clusters;
  const clusters = clustersOf(data, width, scale);
  remembered.set(data, { width, scale, generation, clusters });
  return clusters;
}

// One slot per data object: a resize drag replaces it rather than piling up a width per frame.
const remembered = new WeakMap<TextOutlineSource, {
  width: number; scale: number; generation: number; clusters: TextCluster[];
}>();

function clustersOf(data: TextOutlineSource, width: number, scale: number): TextCluster[] {
  const opts = { scale };
  const box = { x: 0, y: 0, width, height: 0 };
  const { runs, opts: layoutOpts } = outlineLayoutInput(data, box, opts, 'textClusters');
  const line = layoutRuns(runs, layoutOpts).lines[0];
  if (!line || line.cells.length === 0) return [];
  const { paints, paintOf } = paintsOf(runs);
  const deco = lineDecorations(runs, runFaces(runs), (run) => String(paintOf[run]));
  for (const g of line.glyphs) deco.add(g);
  const lineRules = deco.end();

  const glyphOf: PlacedGlyph[] = new Array(line.cells.length);
  for (const g of line.glyphs) glyphOf[g.cell] = g;

  const groups: PlacedGlyph[][] = [];
  let open: PlacedGlyph[] = [];
  line.cells.forEach((cell, i) => {
    open.push(glyphOf[i]!);
    if (cell.clusterEnd || i === line.cells.length - 1) { groups.push(open); open = []; }
  });

  const slots = groups
    .map((glyphs) => ({ glyphs, left: Math.min(...glyphs.map((g) => g.x)) }))
    .sort((a, b) => a.left - b.left);
  return slots.map(({ glyphs, left }, i): TextCluster => {
    const right = i + 1 < slots.length ? slots[i + 1]!.left : line.x1;
    const parts: PolygonPath[][] = paints.map(() => []);
    for (const g of glyphs) {
      if (g.glyph?.color || !line.cells[g.cell]!.drawsInk) continue;
      const outline = placedGlyphOutline(g, -left, -line.baselineY, 'textClusters', true);
      if (outline) parts[paintOf[g.run]!]!.push(outline);
    }
    const paths: TextPaintPath[] = [];
    parts.forEach((p, k) => { if (p.length > 0) paths.push({ ...paints[k]!, path: joinPaths(p) }); });
    const rules: TextClusterRule[] = [];
    for (const r of lineRules) {
      const x0 = Math.max(r.x0, left);
      const x1 = Math.min(r.x1, right);
      if (!(x1 > x0)) continue;
      const { fill, stroke } = paints[paintOf[r.run]!]!;
      rules.push({
        kind: r.kind, x0: x0 - left, x1: x1 - left, y0: r.y0 - line.baselineY, y1: r.y1 - line.baselineY,
        fill, ...(stroke ? { stroke } : {}),
      });
    }
    const first = glyphs[0]!;
    const xHeight = faceMetricsOf(first.resolved)?.xHeight;
    return {
      x: left - line.x0,
      advance: right - left,
      paths,
      middle: (xHeight === undefined ? MIDDLE_FALLBACK : xHeight / 2) * first.fontSize,
      rules,
    };
  });
}
