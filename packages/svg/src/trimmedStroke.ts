/**
 * A trimmed stroke in SVG, which has no trim: the fill keeps the whole outline
 * in one element, and the stroke traces only the span it draws in another, cut
 * where the canvas cuts it, so markers land at the window's ends.
 */
import { splitSubpaths, type Path, type PolygonPath } from '@weasel-js/geom';
import { spanOnPath, trimSpan, trimmedPath, type TrimmedPath } from '@weasel-js/stroke';
import { drawsAsGroup, withoutEndMarkers } from './openSubpathFill';
import type { SvgGroupNode, SvgNode, SvgPathNode, SvgStroke } from './types';
import { hasVariableWidth } from './variableWidthSvg';

const NONE = { kind: 'none' } as const;

/**
 * `node` with its stroke's `trim` drawn into the geometry. Untrimmed, and
 * variable-width, whose outline the trim cuts itself, it is `node` as it is;
 * `null` when it then draws nothing at all. The result states its paint
 * outright rather than inheriting it, so the fill and the cut stroke each
 * keep their own.
 */
export function withTrimDrawn(node: SvgPathNode): SvgPathNode | SvgGroupNode | null {
  const { stroke, inherits: _inherits, ...rest } = node;
  if (!stroke || stroke.trim === undefined || hasVariableWidth(stroke)) return node;
  const { trim, ...bare } = stroke;
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
  const runStroke = (i: number): SvgStroke => {
    const s = cut.fromClosed[i] ? withoutEndMarkers(stroke) : stroke;
    return dashed && cut.dashPhases[i] > 0 ? { ...s, dashOffset: cut.dashPhases[i] } : s;
  };
  const alike = (i: number) => cut.fromClosed[i] === cut.fromClosed[0] && (!dashed || cut.dashPhases[i] === cut.dashPhases[0]);
  const run = (path: SvgPathNode['path'], i: number): SvgPathNode => ({ kind: 'path', path, fill: NONE, stroke: runStroke(i) });
  if (cut.dashPhases.every((_p, i) => alike(i))) return [run(cut.path, 0)];
  return splitSubpaths(cut.path as PolygonPath).map(run);
}

const NOTHING = { start: 1, end: 0 } as const;

/**
 * `stroke` with its trim, measured along `local` as the ribbon measures it,
 * restated as lengths along `drawn`: `local` carried through the pose frame
 * the stroke is drawn in, anchor for anchor.
 */
export function strokeTrimOnPath(stroke: SvgStroke, local: Path, drawn: Path): SvgStroke {
  if (stroke.trim === undefined) return stroke;
  const span = trimSpan(local, stroke.trim);
  const on = span && spanOnPath(span, local, drawn);
  return { ...stroke, trim: on ? { start: { length: on.from }, end: { length: on.to } } : NOTHING };
}
