/**
 * A trimmed stroke in SVG, which has no trim: the fill keeps the whole outline
 * in one element, and the stroke traces only the span it draws in another, cut
 * where the canvas cuts it, so markers land at the window's ends.
 */
import { rotateAboutPoint, splitSubpaths, type PolygonPath } from '@weasel-js/geom';
import { trimmedPath, type TrimmedPath } from '@weasel-js/stroke';
import { withoutEndMarkers } from './openSubpathFill';
import { pathBounds } from './serializeBounds';
import type { SvgGroupNode, SvgPathNode, SvgStroke } from './types';
import { hasVariableWidth } from './variableWidthSvg';

const NONE = { kind: 'none' } as const;

/**
 * `node` with its stroke's `trim` drawn into the geometry. Untrimmed, and
 * variable-width, whose outline the trim cuts itself, it is `node` as it is.
 * The result states its paint outright rather than inheriting it, so the
 * fill and the cut stroke each keep their own.
 */
export function withTrimDrawn(node: SvgPathNode): SvgPathNode | SvgGroupNode {
  const { stroke, inherits: _inherits, ...rest } = node;
  if (stroke?.trim === undefined || hasVariableWidth(stroke)) return node;
  const { trim, ...bare } = stroke;
  const cut = trimmedPath(node.path, trim);
  const children: SvgPathNode[] = [
    ...(node.fill.kind === 'none' ? [] : [{ kind: 'path', path: node.path, fill: node.fill } as const]),
    ...(cut ? strokeRuns(cut, bare) : []),
  ];
  if (children.length === 0) return rest;
  if (children.length === 1 && !node.rotation) return { ...rest, ...children[0] };
  const group: SvgGroupNode = { kind: 'group', children };
  if (node.rotation) {
    const b = pathBounds(node.path);
    group.transform = rotateAboutPoint((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, node.rotation);
  }
  if (node.opacity != null) group.opacity = node.opacity;
  if (node.hidden) group.hidden = true;
  if (node.meta) group.meta = node.meta;
  return group;
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
