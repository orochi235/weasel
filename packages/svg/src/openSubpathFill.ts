/** Writing a path whose open subpaths no fill closes: SVG always closes one. */

import { fillsOpenSubpaths, rotateAboutPoint, splitByClosure, splitSubpaths } from '@weasel-js/geom';
import { pathBounds } from './serializeBounds';
import type { SvgGroupNode, SvgPathNode, SvgStroke } from './types';

const capsEnds = (stroke: SvgStroke | undefined): boolean =>
  stroke?.markerStart !== undefined || stroke?.markerEnd !== undefined;

function withoutEndMarkers(stroke: SvgStroke): SvgStroke {
  const { markerStart: _start, markerEnd: _end, ...rest } = stroke;
  return rest;
}

/**
 * `node` as SVG can draw it. Where a fill leaves the path's open subpaths
 * empty, they are written with no fill: alone, or beside the closed subpaths
 * in a group that takes the node's opacity, rotation, and metadata.
 *
 * SVG draws one start and one end marker per `<path>`, and the renderer one
 * pair per open subpath, so a stroke with either is written one open subpath
 * to a `<path>`, and the closed subpaths without them.
 */
export function withOpenSubpathsUnfilled(node: SvgPathNode): SvgPathNode | SvgGroupNode {
  const path = node.path;
  if (path.kind !== 'polygon' || node.fill.kind === 'none' || fillsOpenSubpaths(path)) return node;
  const { closed, open } = splitByClosure(path);
  if (!open) return node;
  const { fill, stroke } = node;
  const opens = capsEnds(stroke) ? splitSubpaths(open) : [open];
  if (!closed && opens.length === 1) return { ...node, fill: { kind: 'none' } };
  const piece = (part: typeof path, paint: SvgPathNode['fill'], line = stroke): SvgPathNode =>
    ({ kind: 'path', path: part, fill: paint, ...(line ? { stroke: line } : {}) });
  const group: SvgGroupNode = {
    kind: 'group',
    children: [
      ...(closed ? [piece(closed, fill, stroke && withoutEndMarkers(stroke))] : []),
      ...opens.map((part) => piece(part, { kind: 'none' })),
    ],
  };
  if (node.rotation != null && node.rotation !== 0) {
    const b = pathBounds(path);
    group.transform = rotateAboutPoint((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, node.rotation);
  }
  if (node.opacity != null) group.opacity = node.opacity;
  if (node.hidden) group.hidden = true;
  if (node.meta) group.meta = node.meta;
  return group;
}
