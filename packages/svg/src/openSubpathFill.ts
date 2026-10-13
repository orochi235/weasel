/** Writing a path whose open subpaths no fill closes: SVG always closes one. */

import { fillsOpenSubpaths, rotateAboutPoint, splitByClosure } from '@weasel-js/geom';
import { pathBounds } from './serializeBounds';
import type { SvgGroupNode, SvgPathNode } from './types';

/**
 * `node` as SVG can draw it. Where a fill leaves the path's open subpaths
 * empty, they are written with no fill: alone, or beside the closed subpaths
 * in a group that takes the node's opacity, rotation, and metadata.
 */
export function withOpenSubpathsUnfilled(node: SvgPathNode): SvgPathNode | SvgGroupNode {
  const path = node.path;
  if (path.kind !== 'polygon' || node.fill.kind === 'none' || fillsOpenSubpaths(path)) return node;
  const { closed, open } = splitByClosure(path);
  if (!open) return node;
  if (!closed) return { ...node, fill: { kind: 'none' } };
  const { fill, stroke } = node;
  const piece = (part: typeof path, paint: SvgPathNode['fill']): SvgPathNode =>
    ({ kind: 'path', path: part, fill: paint, ...(stroke ? { stroke } : {}) });
  const group: SvgGroupNode = {
    kind: 'group',
    children: [piece(closed, fill), piece(open, { kind: 'none' })],
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
