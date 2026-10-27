/** Ingesting `<marker>` defs the kit has no entry for. */

import {
  type Path, type PolygonPath, PATH_L, PATH_M, PATH_Z, getMarker, resolveMarkerSize, solid,
  type MarkerEntry, type MarkerPaint,
} from '@weasel-js/core';
import { joinPaths, worldCoords } from '@weasel-js/geom';
import type { Matrix, SvgNode, ScreenLength } from './types';
import { multiply, parseTransform } from './transform';
import { styleAt } from './styleAt';
import { WEASEL_NS, WEASEL_NS_PREFIX, type GradientTable } from './gradients';
import { deriveStyle, type StyleContext } from './cascade';
import { readProperty } from './properties';
import { SUPPORTED_LEAF_TAGS, IGNORED_TAGS, lowerLeaf } from './lowerLeaf';
import { parseViewBoxAttr } from './viewBox';
import { readPaint } from './readPaint';

type MarkerRole = 'start' | 'mid' | 'end';
const MARKER_FIELDS = [
  ['markerStart', 'start', 'marker-start'],
  ['markerMid', 'mid', 'marker-mid'],
  ['markerEnd', 'end', 'marker-end'],
] as const;

/**
 * Resolve every marker reference the tree holds that no registered entry
 * answers to, by reading the document's own `<marker>` into a `MarkerEntry`.
 * The reference is rewritten to the entry's key; one the document does not
 * define, or defines with nothing drawable, warns and is dropped.
 *
 * An entry is minted per reference rather than per `<marker>`, because two
 * things SVG decides at the use site are fixed in the kit's entry: a
 * `userSpaceOnUse` marker's size relative to the stroke referencing it, and
 * an `orient="auto"` marker at a start, which the kit always reverses.
 */
export function ingestMarkers(
  root: Element,
  nodes: SvgNode[],
  gradients: GradientTable,
  onWarn: (m: string) => void,
): MarkerEntry[] {
  const defs = new Map<string, Element>();
  const all = root.getElementsByTagName('marker');
  for (let i = 0; i < all.length; i++) {
    const id = all[i].getAttribute('id');
    if (id && !defs.has(id)) defs.set(id, all[i]);
  }
  const minted = new Map<string, MarkerEntry | null>();

  const resolve = (
    stroke: { markerStart?: unknown; markerMid?: unknown; markerEnd?: unknown },
    width: ScreenLength | undefined,
  ): void => {
    const w = width === undefined ? 1 : typeof width === 'number' ? width : width.px;
    for (const [field, role, attr] of MARKER_FIELDS) {
      const id = stroke[field];
      if (typeof id !== 'string' || getMarker(id) !== undefined) continue;
      const el = defs.get(id);
      if (!el) {
        onWarn(`${attr} references #${id}, which is neither a kit marker nor defined in the document`);
        delete stroke[field];
        continue;
      }
      const sized = sizedMarkerRef(el);
      if (sized) {
        // An unregistered key comes along as the def's geometry in marker
        // units: the def is drawn in user space at one unit per resolved size.
        if (getMarker(sized.key) === undefined && !minted.has(sized.key)) {
          const entry = markerEntryFrom(el, id, role, resolveMarkerSize(sized, 1), gradients, onWarn);
          minted.set(sized.key, entry && { ...entry, id: sized.key });
        }
        if (minted.get(sized.key) === null) delete stroke[field];
        else stroke[field] = sized;
        continue;
      }
      const cacheKey = `${id}\u0000${role}\u0000${w}`;
      if (!minted.has(cacheKey)) minted.set(cacheKey, markerEntryFrom(el, id, role, w, gradients, onWarn));
      const entry = minted.get(cacheKey)!;
      if (entry) stroke[field] = entry.id;
      else delete stroke[field];
    }
  };

  const visit = (n: SvgNode): void => {
    if (n.kind === 'group') n.children.forEach(visit);
    else if (n.kind === 'path' && n.stroke) resolve(n.stroke, n.stroke.width);
    else if (n.kind === 'text') {
      if (n.stroke) resolve(n.stroke, n.stroke.width);
      for (const run of n.runs ?? []) {
        if (run.stroke) resolve(run.stroke, run.stroke.width ?? n.stroke?.width);
      }
    }
  };
  nodes.forEach(visit);

  const out = new Map<string, MarkerEntry>();
  for (const entry of minted.values()) if (entry) out.set(entry.id, entry);
  return [...out.values()];
}

function weaselAttr(el: Element, name: string): string | null {
  return el.getAttributeNS(WEASEL_NS, name) ?? el.getAttribute(`${WEASEL_NS_PREFIX}:${name}`);
}

/** The reference a sized-marker def this package wrote stands for: its key
 *  and size, read off the private namespace. */
function sizedMarkerRef(el: Element): { key: string; size: ScreenLength } | undefined {
  const key = weaselAttr(el, 'key');
  const raw = weaselAttr(el, 'size')?.trim();
  if (!key || !raw) return undefined;
  const px = raw.endsWith('px');
  const n = parseFloat(px ? raw.slice(0, -2) : raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return { key, size: px ? { px: n } : n };
}

/** How far a line stops short of the marker, in marker units — written by
 *  this package's serializer, and 0 for any other document's marker. */
function markerInsetAttr(el: Element): number {
  const n = parseFloat(weaselAttr(el, 'inset') ?? '');
  return Number.isFinite(n) && n > 0 ? n : 0;
}


/** SVG 2's keyword forms of `refX` / `refY`, else a number. */
function markerRef(raw: string | null, lo: number, span: number): number {
  const v = raw?.trim();
  if (v === 'left' || v === 'top') return lo;
  if (v === 'center') return lo + span / 2;
  if (v === 'right' || v === 'bottom') return lo + span;
  const n = v ? parseFloat(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

/** `orient` as the kit's `'auto' | radians`, with whether a start reference
 *  has to be turned around to match what SVG draws. Absent is SVG's `0`. */
function markerOrient(raw: string | null): { orient: 'auto' | number; reverseAtStart: boolean } {
  const v = raw?.trim() ?? '';
  if (v === 'auto') return { orient: 'auto', reverseAtStart: true };
  if (v === 'auto-start-reverse') return { orient: 'auto', reverseAtStart: false };
  const m = /^(-?[\d.]+(?:e-?\d+)?)(deg|rad|grad|turn)?$/i.exec(v);
  if (!m) return { orient: 0, reverseAtStart: false };
  const n = parseFloat(m[1]);
  const unit = (m[2] ?? 'deg').toLowerCase();
  const rad = unit === 'rad' ? n
    : unit === 'grad' ? (n * Math.PI) / 200
    : unit === 'turn' ? n * 2 * Math.PI
    : (n * Math.PI) / 180;
  return { orient: rad, reverseAtStart: false };
}

function markerPaint(
  style: StyleContext,
  attr: 'fill' | 'stroke',
  gradients: GradientTable,
  onWarn: (m: string) => void,
): MarkerPaint {
  const context = readProperty(attr, style[attr]);
  if (context?.kind === 'context') {
    if (context.of === 'fill') onWarn(`a marker's ${attr}="context-fill" is read as the line's stroke paint`);
    return 'line';
  }
  const paint = readPaint(style, attr, '#000000', gradients, onWarn);
  if (paint.kind === 'none') return 'none';
  if (paint.kind === 'gradient') return paint.paint;
  return paint.opacity != null ? { ...solid(paint.color), opacity: paint.opacity } : solid(paint.color);
}

function asPolygon(path: Path): PolygonPath {
  if (path.kind === 'polygon') return path;
  const { x, y, width: w, height: h } = path as { x: number; y: number; width: number; height: number };
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
    coords: new Float32Array([x, y, x + w, y, x + w, y + h, x, y + h]),
    fillRule: 'nonzero',
  };
}

/** FNV-1a, for a key that tells apart two documents' same-named markers. */
function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * One `<marker>` as a `MarkerEntry` for a reference in `role` from a stroke
 * `strokeWidth` wide.
 *
 * The content is mapped into marker units — the viewBox scaled onto
 * `markerWidth` × `markerHeight` under `preserveAspectRatio`, with
 * `refX` / `refY` moved to the origin, which is where the kit anchors every
 * entry. The key is the id plus a hash of what the entry draws, so the same
 * id in two documents never collides in the global registry, and an entry
 * this package exported reads back under the key it went out with.
 *
 * All parts merge into one path painted with the first part's fill and
 * outline, since an entry has one of each. `overflow` clipping is not
 * modeled.
 */
function markerEntryFrom(
  el: Element,
  id: string,
  role: MarkerRole,
  strokeWidth: number,
  gradients: GradientTable,
  onWarn: (m: string) => void,
): MarkerEntry | null {
  const num = (name: string, fallback: number): number => {
    const n = parseFloat(el.getAttribute(name) ?? '');
    return Number.isFinite(n) ? n : fallback;
  };
  const vb = parseViewBoxAttr(el.getAttribute('viewBox'));
  let sx = 1, sy = 1;
  if (vb && vb.width > 0 && vb.height > 0) {
    sx = num('markerWidth', 3) / vb.width;
    sy = num('markerHeight', 3) / vb.height;
    const par = el.getAttribute('preserveAspectRatio')?.trim() ?? '';
    if (!par.startsWith('none')) {
      const s = par.endsWith('slice') ? Math.max(sx, sy) : Math.min(sx, sy);
      sx = s;
      sy = s;
    }
  }
  const refX = markerRef(el.getAttribute('refX'), vb?.x ?? 0, vb?.width ?? 0);
  const refY = markerRef(el.getAttribute('refY'), vb?.y ?? 0, vb?.height ?? 0);
  // Marker units are stroke widths already, unless the marker is sized in
  // user space; then this reference's width converts it.
  const k = el.getAttribute('markerUnits') === 'userSpaceOnUse' && strokeWidth > 0
    ? 1 / strokeWidth
    : 1;
  const { orient, reverseAtStart } = markerOrient(el.getAttribute('orient'));
  const turn = role === 'start' && reverseAtStart ? -1 : 1;
  const base: Matrix = [turn * sx * k, 0, 0, turn * sy * k, -turn * sx * k * refX, -turn * sy * k * refY];

  const parts: { path: PolygonPath; style: StyleContext }[] = [];
  const collect = (parent: Element, m: Matrix, style: StyleContext): void => {
    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i];
      const tag = child.tagName.toLowerCase();
      const cm = multiply(m, parseTransform(child.getAttribute('transform'), onWarn));
      const cs = deriveStyle(style, child);
      if (tag === 'g') collect(child, cm, cs);
      else if (SUPPORTED_LEAF_TAGS.has(tag)) {
        const path = lowerLeaf(child, tag, cm, onWarn);
        if (path) parts.push({ path: asPolygon(path), style: cs });
      } else if (!IGNORED_TAGS.has(tag)) {
        onWarn(`<marker id="${id}"> child <${child.tagName}> is not supported; skipped`);
      }
    }
  };
  // The content inherits from the marker's own ancestors, never from the
  // element that references it.
  collect(el, base, styleAt(el));
  if (parts.length === 0) {
    onWarn(`<marker id="${id}"> draws nothing this kit can read; dropped`);
    return null;
  }

  const first = parts[0].style;
  const fill = markerPaint(first, 'fill', gradients, onWarn);
  const outlinePaint = markerPaint(first, 'stroke', gradients, onWarn);
  const outlineWidth = parseFloat(first['stroke-width'] ?? '1') * Math.sqrt(sx * sy) * k;
  const outline = outlinePaint !== 'none' && outlineWidth > 0
    ? { width: outlineWidth, paint: outlinePaint }
    : false;
  if (parts.some((p) => JSON.stringify(p.style) !== JSON.stringify(first))) {
    onWarn(`<marker id="${id}"> paints its parts differently; all take the first part's paint`);
  }

  const joined = joinPaths(parts.map((p) => p.path));
  const commands = joined.commands;
  const coords = worldCoords(joined);
  const fillRule = parts[0].path.fillRule ?? 'nonzero';

  const inset = markerInsetAttr(el);
  const round = (v: number): number => Math.round(v * 1e4) / 1e4 + 0;
  const hash = shortHash(JSON.stringify([
    Array.from(commands), Array.from(coords, round), fillRule, fill, outline,
    typeof orient === 'number' ? round(orient) : orient,
    ...(inset !== 0 ? [round(inset)] : []),
  ]));
  const key = id.endsWith(`-${hash}`) ? id : `${id}-${hash}`;

  return {
    id: key,
    reads: [],
    path: ({ size }) => {
      const scaled = new Float32Array(coords.length);
      for (let i = 0; i < coords.length; i++) scaled[i] = coords[i] * size;
      return { kind: 'polygon', commands, coords: scaled, fillRule };
    },
    fill,
    outline,
    orient,
    inset,
  };
}
