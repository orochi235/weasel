/** Lowering a basic shape element (`<rect>`, `<path>`, …) to a kit path. */

import {
  type Path, type PolygonPath, PATH_L, PATH_M, PATH_Z, pathFromD, transformPath,
} from '@weasel-js/core';
import {
  rectElementToPath, circleToPath, ellipseToPath, lineToPath, parsePoints, polylineToPath,
  polygonToPath, AUTO_ORIGIN,
} from './shapes';
import { hasOpenSubpath, worldCoords } from '@weasel-js/geom';
import type { Matrix } from './types';
import { readLength } from './lengths';

// Every tag set here is compared against a lowercased `tagName`.
/** Element tags we accept and lower; anything else triggers a warning. */
export const SUPPORTED_LEAF_TAGS = new Set([
  'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path',
]);

export const IGNORED_TAGS = new Set([
  'defs', 'lineargradient', 'radialgradient', 'pattern', 'marker', 'clippath',
  'title', 'desc', 'metadata', 'style',
]);

export function lowerLeaf(
  el: Element,
  tag: string,
  m: Matrix,
  onWarn: (msg: string) => void,
): Path | null {
  const x = (name: string): number => readLength(el, name, 'x', 0, onWarn);
  const y = (name: string): number => readLength(el, name, 'y', 0, onWarn);
  const r = (name: string): number => readLength(el, name, 'other', 0, onWarn);
  if (tag === 'rect') {
    return rectElementToPath(x('x'), y('y'), x('width'), y('height'), x('rx'), y('ry'), m);
  }
  if (tag === 'circle') return circleToPath(x('cx'), y('cy'), r('r'), m);
  if (tag === 'ellipse') return ellipseToPath(x('cx'), y('cy'), x('rx'), y('ry'), m);
  if (tag === 'line') return lineToPath(x('x1'), y('y1'), x('x2'), y('y2'), m);
  if (tag === 'polyline') return svgFilled(polylineToPath(parsePoints(el.getAttribute('points') ?? ''), m));
  if (tag === 'polygon') return polygonToPath(parsePoints(el.getAttribute('points') ?? ''), m);
  if (tag === 'path') {
    const d = el.getAttribute('d') ?? '';
    if (!d.trim()) {
      onWarn('<path> with empty d=');
      return null;
    }
    const raw = pathFromD(d, onWarn);
    const transformed = transformPath(raw, m, AUTO_ORIGIN);
    // Reconstitute axis-aligned rectangles so a `{ kind: 'rect' }` source
    // node round-trips back into a `{ kind: 'rect' }` parsed node.
    if (transformed.kind === 'polygon') {
      const rect = polygonToRectIfAxisAligned(transformed);
      if (rect) return rect;
    }
    return svgFilled(transformed);
  }
  return null;
}

/** SVG closes an open subpath to fill it, whatever the engine's default says. */
function svgFilled(path: Path): Path {
  return hasOpenSubpath(path) ? { ...(path as PolygonPath), openFill: 'close' } : path;
}

/**
 * Detect a polygon whose 4 vertices form an axis-aligned rectangle (in
 * the canonical `M L L L Z` order produced by our serializer), and
 * reconstitute it as a `RectPath`. Returns null on any deviation.
 */
function polygonToRectIfAxisAligned(p: PolygonPath): Path | null {
  const cmds = p.commands;
  if (cmds.length !== 5) return null;
  if (cmds[0] !== PATH_M) return null;
  if (cmds[1] !== PATH_L || cmds[2] !== PATH_L || cmds[3] !== PATH_L) return null;
  if (cmds[4] !== PATH_Z) return null;
  const c = worldCoords(p);
  if (c.length !== 8) return null;
  const x0 = c[0], y0 = c[1];
  const x1 = c[2], y1 = c[3];
  const x2 = c[4], y2 = c[5];
  const x3 = c[6], y3 = c[7];
  // Axis-aligned rectangle: top edge horizontal, right edge vertical, etc.
  if (y0 !== y1 || x1 !== x2 || y2 !== y3 || x3 !== x0) return null;
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y2);
  const width = Math.abs(x1 - x0);
  const height = Math.abs(y2 - y1);
  if (width === 0 || height === 0) return null;
  return { kind: 'rect', x, y, width, height };
}
