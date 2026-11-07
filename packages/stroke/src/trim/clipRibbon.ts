/**
 * A trimmed stroke's ribbon built once for every trim, for a shader to clip.
 *
 * Every vertex carries an arc length, and a trim becomes the window of
 * lengths a fragment must fall in (`clipWindow`), so animating it changes a
 * uniform rather than the mesh. The ends a cut leaves are built per window,
 * small.
 *
 * Each segment keeps its whole quad at a turn rather than meeting its
 * neighbor inside it (`innerJoins`): a meeting hands part of one segment's
 * ground to the other, which a cut through that other would then clip away.
 * Inside a turn the ribbon so covers twice what `tessellateStroke`'s covers
 * once, which only an opaque stroke cannot show.
 *
 * A closed subpath draws differently whole and cut, joined at its seam or
 * capped there, so it is built twice: closed, shown only while the window
 * covers all of it, and opened at its seam, shown only while it does not.
 */
import type { Path } from '@weasel-js/geom';
import { type Mesh, type Polyline, trimPolyline } from '@weasel-js/geom/tessellate';
import type { Stroke } from '@weasel-js/paint';
import { dashPolylines, type MeasuredPolyline, polylinesLength } from '../tessellate/dash';
import { expandPolyline, type RibbonOut, type RibbonStyle } from '../tessellate/expandPolyline';
import { untrimmedWorldLength } from '../tessellate/ribbonWindow';
import { inkWidth, ribbonMesh, ribbonStyle, strokePolylines } from '../tessellate/stroke';
import { opened } from './windowPolylines';

/** A vertex of an open subpath: drawn where its length is in the window. */
export const CLIP_OPEN = 0;
/** A vertex of a closed subpath built closed: drawn only while the window covers the subpath. */
export const CLIP_WHOLE = 1;
/** A vertex of a closed subpath opened at its seam: drawn where its length is in the window, unless that covers the subpath. */
export const CLIP_CUT = 2;

/** One subpath, where its lengths start in the ribbon's measure. */
export interface ClipSubpath {
  /** Its flattening, which a trim's curve positions are placed on. */
  polyline: Polyline;
  /** The arc length its first point carries. */
  offset: number;
  /** Its own length along `polyline`, a closed one's closing edge included. */
  length: number;
}

/** A ribbon every trim of a stroke can be clipped from. */
export interface ClipRibbon {
  mesh: Mesh;
  /** Four floats a vertex: its arc length; the first and last length of the
   *  closed subpath it belongs to (0 for an open one); and its `CLIP_*` kind. */
  trim: Float32Array;
  subpaths: ClipSubpath[];
  /** What the ribbon strokes as open runs, in length order, each point's
   *  length carried: what a cut end is built from. */
  pieces: MeasuredPolyline[];
  style: RibbonStyle;
  /** The insets each open subpath's run ends take, at a cut as at its own end. */
  startInset: number;
  endInset: number;
  /** Nothing is drawn within this of a subpath's lengths but that subpath. */
  margin: number;
}

/**
 * `stroke`'s ribbon along `path`, untrimmed but for its insets, which are
 * world lengths, with the lengths a trim clips it by. `stroke.trim` is not
 * read: any trim clips the same ribbon.
 */
export function clipRibbon(
  path: Path, stroke: Stroke, opts: { flattenTolerance?: number; startInset?: number; endInset?: number } = {},
): ClipRibbon {
  const style: RibbonStyle = { ...ribbonStyle(stroke), meet: false };
  const si = Math.max(0, opts.startInset ?? 0);
  const ei = Math.max(0, opts.endInset ?? 0);
  // Wider than any inset, so a window pushed past its subpath by one lands in the gap.
  const gap = 1 + 2 * (si + ei);
  const ribbon: ClipRibbon = {
    mesh: ribbonMesh({ verts: [], idx: [], anchorA: [], anchorB: [], anchorT: [] }, path),
    trim: new Float32Array(0), subpaths: [], pieces: [], style, startInset: si, endInset: ei, margin: gap / 4,
  };
  if (!inkWidth(style.width)) return ribbon;
  const { polylines } = strokePolylines(path, stroke, style.width, opts.flattenTolerance);
  const dashLength = stroke.dash === undefined ? undefined : untrimmedWorldLength(polylines, si, ei);
  const dash = (pls: MeasuredPolyline[]) => dashPolylines(pls, stroke.dash, undefined, dashLength);
  const out: RibbonOut = { verts: [], idx: [], anchorA: [], anchorB: [], anchorT: [], lengths: [] };
  const trim: number[] = [];
  const tag = (from: number, lo: number, hi: number, kind: number) => {
    for (let v = from; v < out.verts.length / 2; v++) trim.push(out.lengths![v] ?? lo, lo, hi, kind);
  };

  let offset = 0;
  for (const pl of polylines) {
    const length = polylinesLength([pl]);
    ribbon.subpaths.push({ polyline: pl, offset, length });
    if (pl.closed) {
      let from = out.verts.length / 2;
      for (const piece of dash([pl])) expandPolyline(piece, style, out);
      tag(from, offset, offset + length, CLIP_WHOLE);
      from = out.verts.length / 2;
      expandPieces(dash([measured(opened(pl), offset)]), style, out, ribbon.pieces);
      tag(from, offset, offset + length, CLIP_CUT);
    } else {
      const run = trimPolyline(pl, si, ei);
      const from = out.verts.length / 2;
      if (run) expandPieces(dash([measured(run, offset + (run === pl ? 0 : si))]), style, out, ribbon.pieces);
      tag(from, 0, 0, CLIP_OPEN);
    }
    offset += length + gap;
  }
  ribbon.mesh = ribbonMesh(out, path);
  ribbon.trim = new Float32Array(trim);
  return ribbon;
}

function expandPieces(pieces: MeasuredPolyline[], style: RibbonStyle, out: RibbonOut, into: MeasuredPolyline[]): void {
  for (const piece of pieces) {
    expandPolyline(piece, style, out, piece.lengths);
    into.push(piece);
  }
}

/** `pl` with each point's length along it, starting from `start`. */
function measured(pl: Polyline, start: number): MeasuredPolyline {
  const p = pl.points;
  const lengths = new Float64Array(p.length / 2);
  lengths[0] = start;
  for (let i = 1; i < lengths.length; i++) {
    lengths[i] = lengths[i - 1] + Math.hypot(p[i * 2] - p[i * 2 - 2], p[i * 2 + 1] - p[i * 2 - 1]);
  }
  return { ...pl, lengths };
}
