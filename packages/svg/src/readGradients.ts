/**
 * Reads SVG `<linearGradient>` / `<radialGradient>` elements, and weasel's own
 * conic and mesh gradients, into `Paint` gradient variants. Definitions are
 * indexed by id wherever in the document they appear, and looked up when a
 * `fill` / `stroke` attribute references one as `url(#id)`.
 */

import type { GradStop, Paint } from '@weasel-js/core';
import { parseRatio, readStops } from './gradientStops';
import { resolveLength, type LengthAxis } from './lengths';
import { collectElementsByTag, type ElementTable } from './elements';
import { SUPPORTED_LEAF_TAGS } from './lowerLeaf';
import { WEASEL_NS, WEASEL_NS_PREFIX } from './gradients';

/** Collected gradient definitions, keyed by element id. */
export type GradientTable = Map<string, Paint>;

/** `interpolate` off a gradient element, or `undefined` — for the field's
 *  absence and for a space this package does not model alike. */
function readInterpolate(el: Element, elements: ElementTable): 'oklab' | 'oklch' | undefined {
  const raw = inheritedAttr(el, elements, `${WEASEL_NS_PREFIX}:interpolate`)
    ?? el.getAttributeNS(WEASEL_NS, 'interpolate');
  if (raw === 'oklab' || raw === 'oklch') return raw;
  return undefined;
}

/** The local name of a tag, prefix stripped. */
function localName(tag: string): string {
  const i = tag.indexOf(':');
  return (i < 0 ? tag : tag.slice(i + 1)).toLowerCase();
}

const GRADIENT_TAGS = new Set([
  'lineargradient', 'radialgradient', 'conicgradient', `${WEASEL_NS_PREFIX}:conicgradient`,
  'meshgradient', `${WEASEL_NS_PREFIX}:meshgradient`,
]);

const XLINK_NS = 'http://www.w3.org/1999/xlink';

/** Read every gradient definition in the document, keyed by element id. */
export function collectGradients(svg: Element, onWarn?: (m: string) => void): GradientTable {
  const out: GradientTable = new Map();
  const elements = collectElementsByTag(svg, GRADIENT_TAGS);
  for (const [id, el] of elements) {
    const tag = localName(el.tagName);
    const paint = tag === 'lineargradient'
      ? readLinearGradient(el, elements, onWarn)
      : tag === 'conicgradient'
        ? readConicGradient(el, elements, onWarn)
        : tag === 'meshgradient'
          ? readMeshGradient(el, onWarn)
          : readRadialGradient(el, elements, onWarn);
    if (paint) out.set(id, paint);
  }
  warnUnsupportedDefsChildren(svg, onWarn);
  return out;
}

/** A `<defs>` child something reads: a paint server, marker, clip, style, or what a `<use>` draws. */
const DEFS_READ = new Set(['pattern', 'marker', 'clippath', 'style', 'g', 'symbol', 'text', 'image', 'use', 'a', 'switch', 'svg']);

/** Say once here which `<defs>` child this package does not model (a `<filter>`, a `<mask>`). */
function warnUnsupportedDefsChildren(svg: Element, onWarn?: (m: string) => void): void {
  for (const defs of Array.from(svg.getElementsByTagName('defs'))) {
    for (const child of Array.from(defs.children)) {
      const tag = child.tagName.toLowerCase();
      if (GRADIENT_TAGS.has(tag) || GRADIENT_TAGS.has(localName(tag)) || DEFS_READ.has(tag) || SUPPORTED_LEAF_TAGS.has(tag)) continue;
      onWarn?.(`unsupported <defs> child: <${child.tagName}>`);
    }
  }
}

/**
 * The gradient a `href` / `xlink:href` attribute points at, or null. SVG lets
 * one gradient inherit another's stops and attributes this way, and authoring
 * tools lean on it heavily — a chain that isn't followed resolves to a
 * gradient with no stops, which paints nothing.
 */
function hrefTarget(el: Element, elements: ElementTable): Element | null {
  const raw = el.getAttribute('href')
    ?? el.getAttributeNS(XLINK_NS, 'href')
    ?? el.getAttribute('xlink:href');
  if (!raw || !raw.startsWith('#')) return null;
  return elements.get(raw.slice(1)) ?? null;
}

/** An attribute's value on `el` or, when absent, on the gradient it inherits
 *  from. `seen` breaks a reference cycle. */
function inheritedAttr(
  el: Element, elements: ElementTable, name: string, seen: Set<Element> = new Set(),
): string | null {
  if (el.hasAttribute(name)) return el.getAttribute(name);
  seen.add(el);
  const ref = hrefTarget(el, elements);
  if (!ref || seen.has(ref)) return null;
  return inheritedAttr(ref, elements, name, seen);
}

/** `el`'s own stops or, when it declares none, the stops it inherits. */
function inheritedStops(
  el: Element, elements: ElementTable, onWarn?: (m: string) => void,
  seen: Set<Element> = new Set(),
): GradStop[] {
  const own = readStops(el, onWarn);
  if (own.length > 0) return own;
  seen.add(el);
  const ref = hrefTarget(el, elements);
  if (!ref || seen.has(ref)) return own;
  return inheritedStops(ref, elements, onWarn, seen);
}

/** SVG `gradientUnits` → the kit's `PaintUnits`. SVG's default is
 *  `objectBoundingBox`, which is what the attribute defaults above assume
 *  (`x2="1"`, `r="0.5"`), so the two have to be read together. */
function readGradientUnits(el: Element, elements: ElementTable): 'bounds' | 'world' {
  return inheritedAttr(el, elements, 'gradientUnits') === 'userSpaceOnUse' ? 'world' : 'bounds';
}

/** `gradientTransform` has no slot in the kit's gradient model, so a gradient
 *  carrying one paints in the wrong place rather than not at all. */
function warnGradientTransform(
  el: Element, elements: ElementTable, onWarn?: (m: string) => void,
): void {
  const t = inheritedAttr(el, elements, 'gradientTransform');
  if (t != null && t.trim() !== '') {
    onWarn?.(`gradientTransform="${t}" is not modeled; the gradient paints untransformed`);
  }
}

function num(raw: string | null, fallback: number): number {
  if (raw == null) return fallback;
  const n = parseRatio(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** What SVG paints with and this model does not hold: a radial gradient's
 *  focal point, and any spread but the default `pad`. */
function warnUnmodeled(el: Element, elements: ElementTable, onWarn?: (m: string) => void): void {
  for (const name of ['fx', 'fy', 'fr']) {
    if (inheritedAttr(el, elements, name) != null) {
      onWarn?.(`gradient ${name} is not modeled; the gradient is centered on its cx, cy`);
      break;
    }
  }
  const spread = inheritedAttr(el, elements, 'spreadMethod');
  if (spread === 'reflect' || spread === 'repeat') {
    onWarn?.(`spreadMethod="${spread}" is not modeled; the gradient pads`);
  }
}

/**
 * One gradient coordinate. In `objectBoundingBox` units a percentage is a
 * fraction of the box and `fraction` is the default; in `userSpaceOnUse` it
 * is a length like any other, of the viewport, and SVG's default is the
 * percentage `fraction` spells.
 */
function coord(
  el: Element, elements: ElementTable, name: string, axis: LengthAxis, fraction: number,
  units: 'bounds' | 'world', onWarn?: (m: string) => void,
): number {
  const raw = inheritedAttr(el, elements, name);
  if (units === 'bounds') return num(raw, fraction);
  if (raw != null) return resolveLength(raw, el, name, axis, fraction, onWarn ?? (() => {}));
  // A default with no viewport to be a percentage of stays the bare fraction,
  // unreported: the author wrote nothing wrong.
  let unresolved = false;
  const v = resolveLength(`${fraction * 100}%`, el, name, axis, fraction, () => { unresolved = true; });
  return unresolved ? fraction : v;
}

function readLinearGradient(
  el: Element, elements: ElementTable, onWarn?: (m: string) => void,
): Paint | null {
  warnGradientTransform(el, elements, onWarn);
  warnUnmodeled(el, elements, onWarn);
  const units = readGradientUnits(el, elements);
  const at = (name: string, axis: LengthAxis, fraction: number): number =>
    coord(el, elements, name, axis, fraction, units, onWarn);
  return {
    kind: 'linear-gradient',
    from: { x: at('x1', 'x', 0), y: at('y1', 'y', 0) },
    to: { x: at('x2', 'x', 1), y: at('y2', 'y', 0) },
    stops: inheritedStops(el, elements, onWarn),
    units,
    interpolate: readInterpolate(el, elements),
  };
}

function readRadialGradient(
  el: Element, elements: ElementTable, onWarn?: (m: string) => void,
): Paint | null {
  warnGradientTransform(el, elements, onWarn);
  warnUnmodeled(el, elements, onWarn);
  const units = readGradientUnits(el, elements);
  const at = (name: string, axis: LengthAxis, fraction: number): number =>
    coord(el, elements, name, axis, fraction, units, onWarn);
  return {
    kind: 'radial-gradient',
    center: { x: at('cx', 'x', 0.5), y: at('cy', 'y', 0.5) },
    radius: at('r', 'other', 0.5),
    stops: inheritedStops(el, elements, onWarn),
    units,
    interpolate: readInterpolate(el, elements),
  };
}

function readConicGradient(
  el: Element, elements: ElementTable, onWarn?: (m: string) => void,
): Paint | null {
  warnGradientTransform(el, elements, onWarn);
  return {
    kind: 'conic-gradient',
    center: {
      x: num(inheritedAttr(el, elements, 'cx'), 0.5),
      y: num(inheritedAttr(el, elements, 'cy'), 0.5),
    },
    angle: num(inheritedAttr(el, elements, 'angle'), 0),
    stops: inheritedStops(el, elements, onWarn),
    units: readGradientUnits(el, elements),
    interpolate: readInterpolate(el, elements),
  };
}

/**
 * A `<wzl:meshGradient>` back into the `mesh-gradient` paint core registers.
 *
 * Every patch carries all twelve (or sixteen) of its points, so nothing here
 * infers a shared edge — the trap that makes SVG's own abandoned
 * `<meshgradient>` hard to read correctly. A patch whose attributes do not
 * parse is dropped with a warning rather than guessed at: a mesh missing a
 * patch is visibly wrong, where a mesh holding an invented one is not.
 */
function readMeshGradient(el: Element, onWarn?: (m: string) => void): Paint | null {
  const patches: { points: { x: number; y: number }[]; colors: string[] }[] = [];
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i];
    if (localName(child.tagName) !== 'patch') continue;
    const points = (child.getAttribute('points') ?? '').trim().split(/\s+/)
      .filter(Boolean)
      .map((pair) => {
        const [x, y] = pair.split(',').map(Number);
        return { x, y };
      });
    const colors = (child.getAttribute('colors') ?? '').trim().split(/\s+/).filter(Boolean);
    const sane = (points.length === 12 || points.length === 16)
      && points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      && colors.length === 4;
    if (!sane) {
      onWarn?.(`<${WEASEL_NS_PREFIX}:patch> with ${points.length} points and ${colors.length} colors — dropped`);
      continue;
    }
    patches.push({ points, colors });
  }
  if (patches.length === 0) return null;
  const space = el.getAttribute('interpolate') ?? el.getAttributeNS(WEASEL_NS, 'interpolate');
  return {
    kind: 'mesh-gradient',
    patches,
    units: el.getAttribute('gradientUnits') === 'objectBoundingBox' ? 'bounds' : 'world',
    ...(space === 'oklab' || space === 'oklch' ? { interpolate: space } : {}),
  } as unknown as Paint;
}
