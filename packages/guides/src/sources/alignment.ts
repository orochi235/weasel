import type { Bounds, SnapCollect, SnapMark, SnapProbeAt, SnapSource } from '@weasel-js/core';
import { deriveAlignmentGuides } from '../guides/alignment/derive';
import { stretchSpan } from '../guides/alignment/match';
import type { Guide } from '../guides/types';
import { axisLine, landedBox, landedShift } from './lines';
import { cachedPerScene, type TargetFilter } from './targets';

type Point = { x: number; y: number };
type Axis = 'x' | 'y';

/** Options for `alignmentSnapSource`. */
export interface AlignmentSnapSourceOptions {
  /** A page box whose edges and center are lines too, in the camera's world. */
  page?: Bounds | (() => Bounds | null | undefined);
  /** The lines to align to, in place of the edges and centers of the
   *  subject's siblings (of the scene's top-level nodes, for a point gesture). */
  getCandidates?: () => readonly Guide[];
  /** Which nodes offer lines. Narrows the default siblings; not `getCandidates`. */
  filter?: TargetFilter;
  /** The color of the lines it marks. Default: the readout layer's. */
  color?: string;
  /** Overrides the canvas's reach for these targets, in screen px. */
  reachPx?: number;
}

/** Each axis's lines, sorted by offset, so a probe finds the ones in reach
 *  without walking the rest. */
interface LineIndex { x: readonly Guide[]; y: readonly Guide[] }

function indexLines(lines: readonly Guide[]): LineIndex {
  const sorted = [...lines].sort((a, b) => a.offset - b.offset);
  return { x: sorted.filter((g) => g.axis === 'x'), y: sorted.filter((g) => g.axis === 'y') };
}

function* inReach(lines: readonly Guide[], v: number, reach: number): Generator<Guide> {
  let lo = 0;
  let hi = lines.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].offset < v - reach) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo; i < lines.length && lines[i].offset <= v + reach; i++) yield lines[i];
}

const cross = (a: Axis): Axis => (a === 'x' ? 'y' : 'x');

/** The line `g` drawn from the box (or point) a probe landed in to the
 *  farthest sibling that shares it. */
function lineMark(g: Guide, extent: [number, number], color: string | undefined): SnapMark {
  const span = stretchSpan(g, extent[0], extent[1])?.span ?? { min: extent[0], max: extent[1] };
  const ends = g.axis === 'x'
    ? { from: { x: g.offset, y: span.min }, to: { x: g.offset, y: span.max } }
    : { from: { x: span.min, y: g.offset }, to: { x: span.max, y: g.offset } };
  return { kind: 'line', ...ends, ...(color === undefined ? {} : { color }) };
}

/**
 * The edges and centers of the subject's siblings, and optionally a page, as
 * snap targets: each is a line a box or pointer probe may land on. A move's
 * left, center and right (top, center, bottom) all try every line, as Figma's
 * smart guides do. When the result meets a line, its mark runs from the
 * subject's box to the farthest sibling on that line.
 */
export function alignmentSnapSource(opts: AlignmentSnapSourceOptions = {}): SnapSource {
  const page = () => (typeof opts.page === 'function' ? opts.page() : opts.page) ?? undefined;
  const fromScene = cachedPerScene((boxes) => indexLines(deriveAlignmentGuides(boxes)), opts.filter);
  const linesFor = (q: SnapCollect): LineIndex[] => {
    const pageBox = page();
    const own = opts.getCandidates ? indexLines(opts.getCandidates()) : fromScene(q);
    return [...(own ? [own] : []), ...(pageBox ? [indexLines(deriveAlignmentGuides([], { page: pageBox }))] : [])];
  };
  return {
    id: 'alignment',
    ...(opts.reachPx === undefined ? {} : { reachPx: opts.reachPx }),
    roles: ['box', 'pointer'],
    *collect(q) {
      const indexes = linesFor(q);
      if (indexes.length === 0) return;
      const reach = q.reachWorld(q.reachPx);
      // A resize offers its dragged corner as pointer and as box; the box's
      // probes are the ones whose marks span it.
      const probes = q.probes.some((p) => p.role === 'box') ? q.probes.filter((p) => p.role === 'box') : q.probes;
      for (const p of probes) {
        for (const axis of ['x', 'y'] as const) {
          for (const index of indexes) {
            for (const g of inReach(index[axis], p.at[axis], reach)) {
              yield {
                probe: p.id,
                locus: axisLine(axis, g.offset, p.at),
                mark: (delta: Point) => lineMark(g, extentAcross(q, p, axis, delta), opts.color),
              };
            }
          }
        }
      }
    },
  };
}

/** Where the landed probe's box (its own point, for a pointer) spans the axis
 *  across `axis`. */
function extentAcross(q: SnapCollect, p: SnapProbeAt, axis: Axis, delta: Point): [number, number] {
  const c = cross(axis);
  const landed = p.role === 'box' ? landedBox(q, delta) : null;
  if (landed === null) {
    const shift = landedShift(q, delta);
    return [p.at[c] + shift[c], p.at[c] + shift[c]];
  }
  const lo = c === 'x' ? landed.x : landed.y;
  return [lo, lo + (c === 'x' ? landed.width : landed.height)];
}
