/**
 * A text line as its grapheme clusters, each one's outlines set at its own
 * origin with the slot it takes on the line — the pieces a caller lays out
 * one by one, as text along a path does.
 */
import { faceMetricsOf } from '@weasel-js/font';
import type { PolygonPath } from '@weasel-js/geom';
import { concat, paintsOf, placedGlyphOutline } from './glyphOutlines';
import { layoutRuns, type PlacedGlyph } from './layout/layoutRuns';
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
 * between two clusters belongs to the left one. Decoration rules are left out.
 *
 * Throws `TextOutlinesError` as `textToPath` does, except that a color
 * glyph, or one drawn by a fallback face with no outlines, keeps its slot
 * with no `paths`. Only a code point that inks its slot is drawn, so a color
 * cluster's leading code points stay blank too.
 */
export function textClusters(data: TextOutlineSource, opts: TextClustersOptions = {}): TextCluster[] {
  const box = { x: 0, y: 0, width: opts.width ?? Infinity, height: 0 };
  const { runs, opts: layoutOpts } = outlineLayoutInput(data, box, opts, 'textClusters');
  const line = layoutRuns(runs, layoutOpts).lines[0];
  if (!line || line.cells.length === 0) return [];
  const { paints, paintOf } = paintsOf(runs);

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
    parts.forEach((p, k) => { if (p.length > 0) paths.push({ ...paints[k]!, path: concat(p) }); });
    const first = glyphs[0]!;
    const xHeight = faceMetricsOf(first.resolved)?.xHeight;
    return {
      x: left - line.x0,
      advance: right - left,
      paths,
      middle: (xHeight === undefined ? MIDDLE_FALLBACK : xHeight / 2) * first.fontSize,
    };
  });
}
