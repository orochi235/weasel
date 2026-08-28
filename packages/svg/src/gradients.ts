/**
 * Map between SVG `<linearGradient>` / `<radialGradient>` elements and
 * weasel's `FillStyle` gradient variants. Definitions are indexed by id
 * wherever in the document they appear, and looked up when a `fill` /
 * `stroke` attribute references one as `url(#id)`. On serialize, we
 * emit a fresh `<defs>` block with stable generated ids.
 */

import { getPaintKind } from '@weasel-js/core';
import type { FillStyle, GradStop, GradientUnits } from '@weasel-js/core';
import { parsePaintAttr } from './color';
import { trimNumber } from './transform';
import { patternXml } from './patterns';
import { collectElementsByTag, type ElementTable } from './elements';

/** Collected gradient definitions, keyed by element id. */
export type GradientTable = Map<string, FillStyle>;

const GRADIENT_TAGS = new Set(['lineargradient', 'radialgradient']);

const XLINK_NS = 'http://www.w3.org/1999/xlink';

/** Read every gradient definition in the document, keyed by element id. */
export function collectGradients(svg: Element, onWarn?: (m: string) => void): GradientTable {
  const out: GradientTable = new Map();
  const elements = collectElementsByTag(svg, GRADIENT_TAGS);
  for (const [id, el] of elements) {
    const paint = el.tagName.toLowerCase() === 'lineargradient'
      ? readLinearGradient(el, elements, onWarn)
      : readRadialGradient(el, elements, onWarn);
    if (paint) out.set(id, paint);
  }
  warnUnsupportedDefsChildren(svg, onWarn);
  return out;
}

/** Paint servers aside, a `<defs>` child is something this package does not
 *  model (`<clipPath>`, `<marker>`, a `<use>` template). Say so once here. */
function warnUnsupportedDefsChildren(svg: Element, onWarn?: (m: string) => void): void {
  if (!onWarn) return;
  const defs = svg.getElementsByTagName('defs');
  for (let d = 0; d < defs.length; d++) {
    const root = defs[d];
    for (let i = 0; i < root.children.length; i++) {
      const child = root.children[i];
      const tag = child.tagName.toLowerCase();
      if (GRADIENT_TAGS.has(tag) || tag === 'pattern') continue;
      onWarn(`unsupported <defs> child: <${child.tagName}>`);
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

/** Parse a `stop-opacity` / offset value that may carry a `%` suffix. */
function parseRatio(raw: string): number {
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return NaN;
  return raw.trimEnd().endsWith('%') ? n / 100 : n;
}

function readStops(el: Element, onWarn?: (m: string) => void): GradStop[] {
  const stops: GradStop[] = [];
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i];
    if (c.tagName.toLowerCase() !== 'stop') continue;
    const offsetRaw = parseRatio(c.getAttribute('offset') ?? '0');
    const offset = Number.isFinite(offsetRaw) ? offsetRaw : 0;
    const colorAttr = c.getAttribute('stop-color') ?? '#000000';
    const parsed = parsePaintAttr(colorAttr);
    if (parsed && parsed.kind === 'solid') {
      const opacityAttr = c.getAttribute('stop-opacity');
      const own = opacityAttr != null ? parseRatio(opacityAttr) : NaN;
      const alpha = Number.isFinite(own) ? own : parsed.alpha;
      stops.push({ offset, color: alpha < 1 ? applyAlpha(parsed.color, alpha) : parsed.color });
    } else {
      onWarn?.(`gradient stop has unrecognized stop-color: ${colorAttr}`);
      stops.push({ offset, color: '#000000' });
    }
  }
  return stops;
}

function applyAlpha(hex: string, alpha: number): string {
  // Pack alpha into an 8-digit hex so it round-trips through weasel's
  // string-color storage. This is non-standard CSS hex but parses cleanly
  // back via our color.ts parser.
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  return `${hex}${a.toString(16).padStart(2, '0')}`;
}

/** SVG `gradientUnits` → the kit's `GradientUnits`. SVG's default is
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

function readLinearGradient(
  el: Element, elements: ElementTable, onWarn?: (m: string) => void,
): FillStyle | null {
  warnGradientTransform(el, elements, onWarn);
  return {
    fill: 'linear-gradient',
    from: {
      x: num(inheritedAttr(el, elements, 'x1'), 0),
      y: num(inheritedAttr(el, elements, 'y1'), 0),
    },
    to: {
      x: num(inheritedAttr(el, elements, 'x2'), 1),
      y: num(inheritedAttr(el, elements, 'y2'), 0),
    },
    stops: inheritedStops(el, elements, onWarn),
    units: readGradientUnits(el, elements),
  };
}

function readRadialGradient(
  el: Element, elements: ElementTable, onWarn?: (m: string) => void,
): FillStyle | null {
  warnGradientTransform(el, elements, onWarn);
  return {
    fill: 'radial-gradient',
    center: {
      x: num(inheritedAttr(el, elements, 'cx'), 0.5),
      y: num(inheritedAttr(el, elements, 'cy'), 0.5),
    },
    radius: num(inheritedAttr(el, elements, 'r'), 0.5),
    stops: inheritedStops(el, elements, onWarn),
    units: readGradientUnits(el, elements),
  };
}

/**
 * Pre-pass that assigns stable serialization ids to the paint servers —
 * gradients and patterns — used by any leaf in the tree. We key on object
 * identity so two leaves sharing the exact same `FillStyle` reference reuse
 * one `<defs>` entry; structurally equal but distinct objects get separate
 * ids.
 */
export class PaintServerRegistry {
  private byPaint = new Map<FillStyle, string>();
  private order: FillStyle[] = [];
  private counter = 0;

  register(paint: FillStyle): string {
    const existing = this.byPaint.get(paint);
    if (existing) return existing;
    const id = paint.fill === 'pattern' ? `pat${this.counter++}` : `grad${this.counter++}`;
    this.byPaint.set(paint, id);
    this.order.push(paint);
    return id;
  }

  /** Emit `<defs>...</defs>` XML for every registered paint server. */
  toDefsXml(onWarn?: (m: string) => void): string {
    if (this.order.length === 0) return '';
    const parts: string[] = ['<defs>'];
    for (const paint of this.order) {
      const id = this.byPaint.get(paint)!;
      parts.push(
        paint.fill === 'pattern'
          ? patternXml(id, paint, onWarn)
          : gradientXml(id, paint) || (getPaintKind(paint.fill)?.toSvg?.(id, paint) ?? ''),
      );
    }
    parts.push('</defs>');
    return parts.join('');
  }
}

/** `GradientUnits` → SVG `gradientUnits`. `'screen'` (the kit's default, and
 *  a viewport-fixed wash) has no SVG analog at all; it lowers to user space,
 *  which at least puts the paint somewhere the geometry is. */
function gradientUnitsAttr(units: GradientUnits | undefined): string {
  return units === 'bounds' ? 'objectBoundingBox' : 'userSpaceOnUse';
}

function gradientXml(id: string, paint: FillStyle): string {
  if (paint.fill === 'linear-gradient') {
    const stops = paint.stops.map(stopXml).join('');
    return (
      `<linearGradient id="${id}" gradientUnits="${gradientUnitsAttr(paint.units)}" ` +
      `x1="${trimNumber(paint.from.x)}" y1="${trimNumber(paint.from.y)}" ` +
      `x2="${trimNumber(paint.to.x)}" y2="${trimNumber(paint.to.y)}">${stops}</linearGradient>`
    );
  }
  if (paint.fill === 'radial-gradient') {
    const stops = paint.stops.map(stopXml).join('');
    return (
      `<radialGradient id="${id}" gradientUnits="${gradientUnitsAttr(paint.units)}" ` +
      `cx="${trimNumber(paint.center.x)}" cy="${trimNumber(paint.center.y)}" ` +
      `r="${trimNumber(paint.radius)}">${stops}</radialGradient>`
    );
  }
  return '';
}

function stopXml(s: GradStop): string {
  // Detect packed-alpha hex (#rrggbbaa) and split out stop-opacity.
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(s.color);
  if (m) {
    const alpha = parseInt(m[2], 16) / 255;
    return `<stop offset="${trimNumber(s.offset)}" stop-color="#${m[1].toLowerCase()}" stop-opacity="${trimNumber(alpha)}"/>`;
  }
  return `<stop offset="${trimNumber(s.offset)}" stop-color="${s.color}"/>`;
}
