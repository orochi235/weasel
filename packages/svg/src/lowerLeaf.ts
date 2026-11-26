/** Lowering a basic shape element (`<rect>`, `<path>`, …) to a kit path. */

import {
  type Path, type PolygonPath, PATH_L, PATH_M, PATH_Z, pathFromD, transformPath,
} from '@weasel-js/core';
import {
  autoRadii, rectElementToPath, circleToPath, ellipseToPath, lineToPath, parsePoints, polylineToPath,
  polygonToPath,
} from './shapes';
import { hasOpenSubpath, worldCoords } from '@weasel-js/geom';
import type { Matrix } from './types';
import { WEASEL_NS, WEASEL_NS_PREFIX } from './gradients';
import { readLength } from './lengths';

// Every tag set here is compared against a lowercased `tagName`.
/** Element tags we accept and lower; anything else triggers a warning. */
export const SUPPORTED_LEAF_TAGS = new Set([
  'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path',
]);

export const IGNORED_TAGS = new Set([
  'defs', 'lineargradient', 'radialgradient', 'pattern', 'marker', 'clippath',
  'title', 'desc', 'metadata', 'style', 'symbol',
]);

/** The geometry of a shape element, through `m`, or null for none. A shape the kernel cannot store, its
 *  coordinates past float32's range from the path's origin, is dropped with a warning rather than kept as
 *  `Infinity` and `NaN`. */
export function lowerLeaf(
  el: Element,
  tag: string,
  m: Matrix,
  onWarn: (msg: string) => void,
  fontSize?: number,
): Path | null {
  return storable(lowerLeafPath(el, tag, m, onWarn, fontSize), tag, onWarn);
}

/** `path`, or null with a warning when a number it stores is not finite: a `<tag>` whose geometry reaches
 *  past float32's range from its origin, or a transform that carries it there. */
export function storable(path: Path | null, tag: string, onWarn: (msg: string) => void): Path | null {
  if (path === null || storedFinite(path)) return path;
  onWarn(`<${tag}> reaches past the coordinates a path can store; it is dropped`);
  return null;
}

/** Whether every number `path` stores is finite. */
function storedFinite(path: Path): boolean {
  if (path.kind === 'rect') return [path.x, path.y, path.width, path.height].every(Number.isFinite);
  if (path.origin && !(Number.isFinite(path.origin.x) && Number.isFinite(path.origin.y))) return false;
  for (let i = 0; i < path.coords.length; i++) if (!Number.isFinite(path.coords[i])) return false;
  return true;
}

function lowerLeafPath(
  el: Element,
  tag: string,
  m: Matrix,
  onWarn: (msg: string) => void,
  fontSize: number | undefined,
): Path | null {
  return shapePath(tag, shapeGeometry(el, tag, onWarn, fontSize), m, onWarn);
}

/** A shape element's geometry attributes by name: lengths in user units, `points` and `d` as written. */
export type ShapeGeometry = Readonly<Record<string, number | string>>;

/** Each shape's length attributes, and the axis a percentage of it resolves along; `auto` marks a
 *  radius whose absence is `NaN`, for `autoRadii`. */
const LENGTHS: Readonly<Record<string, readonly (readonly [string, 'x' | 'y' | 'other', ('auto')?])[]>> = {
  rect: [['x', 'x'], ['y', 'y'], ['width', 'x'], ['height', 'y'], ['rx', 'x', 'auto'], ['ry', 'y', 'auto']],
  circle: [['cx', 'x'], ['cy', 'y'], ['r', 'other']],
  ellipse: [['cx', 'x'], ['cy', 'y'], ['rx', 'x', 'auto'], ['ry', 'y', 'auto']],
  line: [['x1', 'x'], ['y1', 'y'], ['x2', 'x'], ['y2', 'y']],
};

/** The attributes `shapePath` lowers a `<tag>` from, read off `el`. */
export function shapeGeometry(el: Element, tag: string, onWarn: (msg: string) => void, fontSize?: number): ShapeGeometry {
  const out: Record<string, number | string> = {};
  for (const [name, axis, auto] of LENGTHS[tag] ?? []) out[name] = readLength(el, name, axis, auto ? NaN : 0, onWarn, fontSize);
  if (tag === 'polyline' || tag === 'polygon') out.points = el.getAttribute('points') ?? '';
  // A shaft the serializer cut back for its heads carries the path as authored.
  if (tag === 'path') out.d = el.getAttributeNS(WEASEL_NS, 'd') ?? el.getAttribute(`${WEASEL_NS_PREFIX}:d`) ?? el.getAttribute('d') ?? '';
  return out;
}

/** A `<tag>` of geometry `g` lowered through `m`, or null where it draws nothing. */
export function shapePath(tag: string, g: ShapeGeometry, m: Matrix, onWarn: (msg: string) => void): Path | null {
  const n = (name: string): number => Number(g[name] ?? 0);
  if (tag === 'rect') return rectElementToPath(n('x'), n('y'), n('width'), n('height'), n('rx'), n('ry'), m);
  if (tag === 'circle') return circleToPath(n('cx'), n('cy'), n('r'), m);
  if (tag === 'ellipse') {
    const [rx, ry] = autoRadii(n('rx'), n('ry'));
    return ellipseToPath(n('cx'), n('cy'), rx, ry, m);
  }
  if (tag === 'line') return lineToPath(n('x1'), n('y1'), n('x2'), n('y2'), m);
  if (tag === 'polyline') return svgFilled(polylineToPath(parsePoints(String(g.points ?? '')), m));
  if (tag === 'polygon') return polygonToPath(parsePoints(String(g.points ?? '')), m);
  if (tag === 'path') {
    const d = String(g.d ?? '');
    if (!d.trim()) {
      onWarn('<path> with empty d=');
      return null;
    }
    const transformed = transformPath(pathFromD(d, onWarn), m);
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
 * Detect a polygon whose 4 vertices form an axis-aligned rectangle traced
 * clockwise from its top-left corner (the order a `RectPath` is drawn in), and
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
  // A rect is drawn clockwise from its top-left corner; any other start or
  // direction moves where the stroke's dashes and trim begin.
  if (y0 !== y1 || x1 !== x2 || y2 !== y3 || x3 !== x0) return null;
  if (!(x1 > x0 && y2 > y1)) return null;
  return { kind: 'rect', x: x0, y: y0, width: x1 - x0, height: y2 - y1 };
}
