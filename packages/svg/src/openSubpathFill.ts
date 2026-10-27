/**
 * Writing a path as SVG draws it. SVG closes every open subpath it fills, and
 * places a stroke's markers by the whole `<path>` where the renderer places
 * them by subpath.
 */

import { fillsOpenSubpaths, rotateAboutPoint, splitByClosure, splitSubpaths, worldCoords, type PolygonPath } from '@weasel-js/geom';
import { pathBounds } from './serializeBounds';
import type { SvgGroupNode, SvgPaint, SvgPathNode, SvgStroke } from './types';

const capsEnds = (stroke: SvgStroke | undefined): boolean =>
  stroke?.markerStart !== undefined || stroke?.markerEnd !== undefined;

const marked = (stroke: SvgStroke | undefined): boolean =>
  capsEnds(stroke) || stroke?.markerMid !== undefined;

function withoutEndMarkers(stroke: SvgStroke): SvgStroke {
  const { markerStart: _start, markerEnd: _end, ...rest } = stroke;
  return rest;
}

/** The stroke a part with no open subpath is written with: SVG caps the ends
 *  of a closed `<path>`, and the renderer caps none. */
const closedStroke = (stroke: SvgStroke | undefined): SvgStroke | undefined =>
  stroke && capsEnds(stroke) ? withoutEndMarkers(stroke) : stroke;

const isClosed = (part: PolygonPath): boolean => splitByClosure(part).open === null;

function samePath(a: PolygonPath, b: PolygonPath): boolean {
  if (a === b) return true;
  const ac = worldCoords(a), bc = worldCoords(b);
  return a.commands.length === b.commands.length && ac.length === bc.length
    && a.commands.every((c, i) => c === b.commands[i]) && ac.every((v, i) => v === bc[i]);
}

/** One `<path>` of the result: a part of the node's path, and what paints it. */
interface Piece {
  path: PolygonPath;
  fill: SvgPaint;
  stroke: SvgStroke | undefined;
}

/**
 * The parts `path` is stroked in. A marked stroke goes one subpath to a part,
 * since SVG draws one start and one end marker per `<path>` and a mid marker
 * on every vertex between them, subpath joins included. An unmarked one stays
 * whole unless its fill covers `closed` alone, which then takes its own part.
 */
function strokeParts(
  path: PolygonPath, stroke: SvgStroke | undefined, filled: PolygonPath | null,
  closed: PolygonPath | null, open: PolygonPath | null,
): Piece[] {
  const none: SvgPaint = { kind: 'none' };
  const subs = marked(stroke) ? splitSubpaths(path) : [];
  if (subs.length > 1) {
    return subs.map((sub) => ({ path: sub, fill: none, stroke: isClosed(sub) ? closedStroke(stroke) : stroke }));
  }
  if (closed && open && filled === closed) {
    return [{ path: closed, fill: none, stroke: closedStroke(stroke) }, { path: open, fill: none, stroke }];
  }
  return [{ path, fill: none, stroke: open ? stroke : closedStroke(stroke) }];
}

/**
 * `node` as SVG can draw it: one `<path>`, or a group of them that takes the
 * node's opacity, rotation, and metadata.
 *
 * A fill covers the whole path, or its closed subpaths alone where the fill
 * leaves open ones empty, and is written once, under every stroke: with the
 * part of the stroke that traces exactly what it fills, or with no stroke.
 */
export function pathAsSvgDraws(node: SvgPathNode): SvgPathNode | SvgGroupNode {
  const { path, fill, stroke } = node;
  if (path.kind !== 'polygon') return capsEnds(stroke) ? { ...node, stroke: closedStroke(stroke) } : node;
  if (path.commands.length === 0) return node;
  const { closed, open } = splitByClosure(path);
  const filled = fill.kind === 'none' ? null : fillsOpenSubpaths(path) ? path : closed;
  const parts = strokeParts(path, stroke, filled, closed, open);
  const pieces = filled ? withFill(parts, filled, fill) : parts;
  if (pieces.length === 1) {
    const only = pieces[0];
    if (only.fill === fill && only.stroke === stroke) return node;
    const { stroke: _stroke, ...rest } = node;
    return { ...rest, fill: only.fill, ...(only.stroke ? { stroke: only.stroke } : {}) };
  }
  const group: SvgGroupNode = {
    kind: 'group',
    children: pieces.map((p): SvgPathNode => ({ kind: 'path', path: p.path, fill: p.fill, ...(p.stroke ? { stroke: p.stroke } : {}) })),
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

/** `parts` with `fill` on `filled`, first so it lies under every stroke. */
function withFill(parts: Piece[], filled: PolygonPath, fill: SvgPaint): Piece[] {
  const host = parts.findIndex((p) => samePath(p.path, filled));
  if (host < 0) return [{ path: filled, fill, stroke: undefined }, ...parts];
  return [{ ...parts[host], fill }, ...parts.filter((_, i) => i !== host)];
}
