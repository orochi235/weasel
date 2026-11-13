/**
 * A trimmed stroke in SVG, which has no trim: the fill keeps the whole outline
 * in one element, and the stroke traces only the span it draws in another, cut
 * where the canvas cuts it, so markers land at the window's ends.
 */
import { fillInPoseFrame } from '@weasel-js/core';
import {
  boundsOfPath, lengthAtCurve, pathLengthTable, type Path,
} from '@weasel-js/geom';
import { trimSpan, trimmedPath, trimmedRuns, type TrimmedPath } from '@weasel-js/stroke';
import { drawsAsGroup, withoutEndMarkers } from './openSubpathFill';
import type { SvgGroupNode, SvgNode, SvgPathNode, SvgStroke } from './types';
import { writesOutline } from './strokeOutlineSvg';

const NONE = { kind: 'none' } as const;

/**
 * `node` with its stroke's `trim` drawn into the geometry. Untrimmed, and
 * written as an outline, which the trim cuts itself, it is `node` as it is;
 * `null` when it then draws nothing at all. The result states its paint
 * outright rather than inheriting it, so the fill and the cut stroke each
 * keep their own.
 */
export function withTrimDrawn(node: SvgPathNode): SvgPathNode | SvgGroupNode | null {
  const { stroke, inherits: _inherits, ...rest } = node;
  if (!stroke || stroke.trim === undefined || writesOutline(stroke)) return node;
  const { trim, ...own } = stroke;
  // A run's own box is not the node's: a box-relative paint is placed on the whole path first.
  const bare = own.paint.kind === 'gradient'
    ? { ...own, paint: { ...own.paint, paint: fillInPoseFrame(own.paint.paint, boundsOfPath(node.path)) } }
    : own;
  const cut = trimmedPath(node.path, trim);
  const children: SvgPathNode[] = [
    ...(node.fill.kind === 'none' ? [] : [{ kind: 'path', path: node.path, fill: node.fill } as const]),
    ...(cut ? strokeRuns(cut, bare) : []),
  ];
  if (children.length === 0) return null;
  if (children.length === 1 && !node.rotation) return { ...rest, ...children[0] };
  return drawsAsGroup(node, children);
}

/** `nodes` with every trimmed stroke drawn by {@link withTrimDrawn}, and what then draws
 *  nothing left out: the tree the serializer registers paints from and writes, so a stroke an
 *  empty window hides registers no marker. */
export function withTrimsDrawn(nodes: readonly SvgNode[]): SvgNode[] {
  const out: SvgNode[] = [];
  for (const n of nodes) {
    const drawn = n.kind === 'path' ? withTrimDrawn(n)
      : n.kind === 'group' ? { ...n, children: withTrimsDrawn(n.children) } : n;
    if (drawn) out.push(drawn);
  }
  return out;
}

/** The elements `cut` is stroked in: one, unless its runs differ in dash phase
 *  or in taking end markers, which SVG states per element. */
function strokeRuns(cut: TrimmedPath, stroke: SvgStroke): SvgPathNode[] {
  const dashed = (stroke.dash?.length ?? 0) > 0;
  return trimmedRuns(cut, { dashed, byClosed: true }).map(({ path, dashPhase, fromClosed }) => {
    const s = fromClosed ? withoutEndMarkers(stroke) : stroke;
    return { kind: 'path', path, fill: NONE, stroke: dashed && dashPhase > 0 ? { ...s, dashOffset: dashPhase + (s.dashOffset ?? 0) } : s };
  });
}

const NOTHING = { start: 1, end: 0 } as const;

/**
 * `stroke` with its trim, resolved along `local` as the ribbon resolves it,
 * restated as exact lengths along `drawn`: `local` carried through the pose
 * frame the stroke is drawn in, command for command, so the curve positions
 * the trim cuts at name the same points on it.
 */
export function strokeTrimOnPath(stroke: SvgStroke, local: Path, drawn: Path): SvgStroke {
  if (stroke.trim === undefined) return stroke;
  const span = trimSpan(local, stroke.trim);
  if (!span) return { ...stroke, trim: NOTHING };
  const table = pathLengthTable(drawn);
  return { ...stroke, trim: { start: { length: lengthAtCurve(table, span.from) }, end: { length: lengthAtCurve(table, span.to) } } };
}
