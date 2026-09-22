/**
 * Map between SVG `<linearGradient>` / `<radialGradient>` elements and
 * weasel's `FillStyle` gradient variants. Definitions are indexed by id
 * wherever in the document they appear, and looked up when a `fill` /
 * `stroke` attribute references one as `url(#id)`. On serialize, we
 * emit a fresh `<defs>` block with stable generated ids.
 */

import { getPaintKind, getMarker } from '@weasel-js/core';
import type { FillStyle, GradStop, GradientUnits, MarkerEntry, MarkerPaint, Path } from '@weasel-js/core';
import { ownProp } from './cascade';
import { parsePaintAttr } from './color';
import { trimNumber } from './transform';
import { patternXml } from './patterns';
import { collectElementsByTag, type ElementTable } from './elements';
import { serializePathD } from './path-serializer';

/** Collected gradient definitions, keyed by element id. */
export type GradientTable = Map<string, FillStyle>;

/**
 * The namespace weasel's own paint servers are written in, and the prefix they
 * are written under. A conic gradient has no SVG element to target — SVG has
 * `linearGradient` and `radialGradient` and nothing else — so it goes out as a
 * foreign-namespaced def that this package reads back and every other renderer
 * skips in favor of the paint fallback color beside the reference.
 *
 * A registered paint kind's own `toSvg` may use this prefix too: the root
 * declares it whenever any paint in the document lacks a native SVG form.
 */
export const WEASEL_NS = 'urn:weasel-js:svg';
export const WEASEL_NS_PREFIX = 'wzl';

/** `true` when SVG has a paint server for this kind, so the reference needs no
 *  fallback color and the root needs no foreign namespace. */
function hasNativeSvgForm(paint: FillStyle): boolean {
  const kind = paint.fill ?? 'solid';
  return kind === 'solid' || kind === 'linear-gradient' || kind === 'radial-gradient' || kind === 'pattern';
}

/**
 * The spaces `interpolate` can name, as SVG spells them. SVG's own
 * `color-interpolation` carries `sRGB` and `linearRGB` only, so anything
 * perceptual goes out as a namespaced attribute a foreign renderer ignores —
 * which leaves it interpolating in sRGB. That is a shifted midpoint rather
 * than a lost paint, so these gradients keep their native element and take no
 * fallback color.
 */
const INTERPOLATE_SPACES = new Set(['rgb', 'oklab', 'oklch']);

/** The `wzl:interpolate` attribute a gradient needs, or `''` for the sRGB
 *  default every other renderer already assumes. */
function interpolateAttr(space: string | undefined): string {
  if (!space || space === 'rgb') return '';
  return ` ${WEASEL_NS_PREFIX}:interpolate="${space}"`;
}

/** `interpolate` off a gradient element, or `undefined` — for the field's
 *  absence and for a space this package does not model alike. */
function readInterpolate(el: Element, elements: ElementTable): 'oklab' | 'oklch' | undefined {
  const raw = inheritedAttr(el, elements, `${WEASEL_NS_PREFIX}:interpolate`)
    ?? el.getAttributeNS(WEASEL_NS, 'interpolate');
  if (raw === 'oklab' || raw === 'oklch') return raw;
  return undefined;
}

/** Whether any gradient in the document names a space SVG cannot, so the root
 *  has to declare the namespace the attribute is written in. */
function usesInterpolateAttr(paint: FillStyle): boolean {
  const space = (paint as { interpolate?: string }).interpolate;
  return space != null && space !== 'rgb' && INTERPOLATE_SPACES.has(space);
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

/** Paint servers, `<marker>`, `<clipPath>` and `<style>` aside, a `<defs>` child is
 *  something this package does not model (a `<use>` template, a `<filter>`).
 *  Say so once here. */
function warnUnsupportedDefsChildren(svg: Element, onWarn?: (m: string) => void): void {
  if (!onWarn) return;
  const defs = svg.getElementsByTagName('defs');
  for (let d = 0; d < defs.length; d++) {
    const root = defs[d];
    for (let i = 0; i < root.children.length; i++) {
      const child = root.children[i];
      const tag = child.tagName.toLowerCase();
      if (GRADIENT_TAGS.has(tag) || GRADIENT_TAGS.has(localName(tag))) continue;
      if (tag === 'pattern' || tag === 'marker' || tag === 'clippath' || tag === 'style') continue;
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
    const colorAttr = ownProp(c, 'stop-color') ?? '#000000';
    const parsed = parsePaintAttr(colorAttr);
    if (parsed && parsed.kind === 'solid') {
      const opacityAttr = ownProp(c, 'stop-opacity');
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
    interpolate: readInterpolate(el, elements),
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
    interpolate: readInterpolate(el, elements),
  };
}

function readConicGradient(
  el: Element, elements: ElementTable, onWarn?: (m: string) => void,
): FillStyle | null {
  warnGradientTransform(el, elements, onWarn);
  return {
    fill: 'conic-gradient',
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
function readMeshGradient(el: Element, onWarn?: (m: string) => void): FillStyle | null {
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
    fill: 'mesh-gradient',
    patches,
    units: el.getAttribute('gradientUnits') === 'objectBoundingBox' ? 'bounds' : 'world',
    ...(space === 'oklab' || space === 'oklch' ? { interpolate: space } : {}),
  } as unknown as FillStyle;
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

  // Marker keys referenced by any stroke, in first-use order. The `<defs>`
  // id is the marker key itself, not a minted counter id: `parseSvg` reads a
  // `marker-end="url(#id)"` fragment back as the marker key directly when the
  // registry knows it, so a synthetic id would come back as a stranger.
  private markerKeys: string[] = [];
  private markerKeySet = new Set<string>();

  // Clip paths, in first-use order. Identity, not value: two groups clipped by
  // equal outlines get a def each, which costs bytes and misleads nobody.
  private clips: Path[] = [];
  private clipIds = new Map<Path, string>();

  register(paint: FillStyle): string {
    const existing = this.byPaint.get(paint);
    if (existing) return existing;
    const id = paint.fill === 'pattern' ? `pat${this.counter++}` : `grad${this.counter++}`;
    this.byPaint.set(paint, id);
    this.order.push(paint);
    return id;
  }

  /**
   * The `fill` / `stroke` attribute value referencing this paint server: a
   * `url(#id)` reference, plus the fallback paint SVG's own grammar allows
   * after one for any kind SVG cannot express. A renderer that cannot resolve
   * the reference takes the fallback instead of dropping the fill, which is
   * the difference between a flat shape and a vanished one.
   */
  ref(paint: FillStyle): string {
    const id = this.register(paint);
    if (hasNativeSvgForm(paint)) return `url(#${id})`;
    return `url(#${id}) ${paintFallback(paint)}`;
  }

  /** Whether any registered paint serializes outside SVG's own vocabulary, so
   *  the root has to declare {@link WEASEL_NS}. */
  usesPrivateNamespace(): boolean {
    return this.order.some((paint) => !hasNativeSvgForm(paint) || usesInterpolateAttr(paint));
  }

  /** The `<defs>` id for a marker key — the key itself, minting nothing.
   *  `undefined` when nothing is registered under `key`, so a caller emits no
   *  attribute at all rather than a `url(#…)` pointing at a def that will
   *  never be written. */
  markerId(key: string): string | undefined {
    if (getMarker(key) === undefined) return undefined;
    if (!this.markerKeySet.has(key)) {
      this.markerKeySet.add(key);
      this.markerKeys.push(key);
    }
    return key;
  }

  /** Mint (or recall) the `<defs>` id for a clip outline. */
  clipId(path: Path): string {
    const existing = this.clipIds.get(path);
    if (existing) return existing;
    const id = `clip${this.clips.length}`;
    this.clipIds.set(path, id);
    this.clips.push(path);
    return id;
  }

  /** Emit `<defs>...</defs>` XML for every registered paint server, marker
   *  and clip path. */
  toDefsXml(onWarn?: (m: string) => void): string {
    if (this.order.length === 0 && this.markerKeys.length === 0 && this.clips.length === 0) {
      return '';
    }
    const parts: string[] = ['<defs>'];
    for (const paint of this.order) {
      parts.push(paintServerXml(this.byPaint.get(paint)!, paint, onWarn));
    }
    for (const key of this.markerKeys) {
      const entry = getMarker(key);
      if (!entry) continue;
      parts.push(entry.toSvg ? entry.toSvg(key, entry) : defaultMarkerXml(key, entry, onWarn));
    }
    for (const path of this.clips) {
      parts.push(
        `<clipPath id="${this.clipIds.get(path)!}">`
        + `<path d="${serializePathD(path)}"/>`
        + '</clipPath>',
      );
    }
    parts.push('</defs>');
    return parts.join('');
  }
}

/** The `<marker>` def for an entry with no `toSvg` of its own. */
function defaultMarkerXml(id: string, entry: MarkerEntry, onWarn?: (m: string) => void): string {
  const path = entry.path({ size: 1, stroke: { paint: { fill: 'solid', color: '#000' } } });
  const d = serializePathD(path);
  const fill = markerPaintAttrs('fill', entry.fill, id, onWarn);
  const outline = entry.outline
    ? ` ${markerPaintAttrs('stroke', entry.outline.paint, id, onWarn)} stroke-width="${trimNumber(entry.outline.width)}"`
      + ' stroke-linecap="round" stroke-linejoin="round"'
    : '';
  // The kit turns every start marker around, which is what SVG 2 spells
  // `auto-start-reverse`; plain `auto` would point a start head into the line.
  const orient = typeof entry.orient === 'number'
    ? trimNumber((entry.orient * 180) / Math.PI)
    : 'auto-start-reverse';
  // `overflow="visible"` overrides the UA default of `hidden`, which would
  // otherwise clip the arrowhead to the marker's viewport.
  return (
    `<marker id="${id}" markerUnits="strokeWidth" markerWidth="8" markerHeight="8"` +
    ` refX="0" refY="0" orient="${orient}" overflow="visible">` +
    `<path d="${d}" ${fill}${outline}/></marker>`
  );
}

/** A marker paint as `fill` / `stroke` attributes. `'line'` is SVG 2's
 *  `context-stroke`; a paint server has no `<defs>` slot from here, so it
 *  falls back to the line's paint and says so. */
function markerPaintAttrs(
  attr: 'fill' | 'stroke',
  paint: MarkerPaint | undefined,
  id: string,
  onWarn?: (m: string) => void,
): string {
  if (paint === 'none') return `${attr}="none"`;
  if (paint === undefined || paint === 'line') return `${attr}="context-stroke"`;
  if ('color' in paint && (paint.fill === undefined || paint.fill === 'solid')) {
    return paint.opacity != null && paint.opacity !== 1
      ? `${attr}="${paint.color}" ${attr}-opacity="${trimNumber(paint.opacity)}"`
      : `${attr}="${paint.color}"`;
  }
  onWarn?.(`marker "${id}" ${attr} is a paint server, which a <marker> def cannot reference here; written as the line's paint`);
  return `${attr}="context-stroke"`;
}

/** One paint server's `<defs>` entry: the built-in mapping, else the kind's
 *  own `toSvg`, else nothing plus a warning. The referencing element already
 *  carries `fill="url(#id)"`, so a silent omission is a dangling reference and
 *  the shape vanishes in a viewer. */
function paintServerXml(id: string, paint: FillStyle, onWarn?: (m: string) => void): string {
  if (paint.fill === 'pattern') return patternXml(id, paint, onWarn);
  const builtin = gradientXml(id, paint);
  if (builtin) return builtin;
  const custom = getPaintKind(paint.fill)?.toSvg?.(id, paint);
  if (custom) return custom;
  onWarn?.(`${paint.fill} fill has no vector form — omitted from <defs>`);
  return '';
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
      `x2="${trimNumber(paint.to.x)}" y2="${trimNumber(paint.to.y)}"` +
      `${interpolateAttr(paint.interpolate)}>${stops}</linearGradient>`
    );
  }
  if (paint.fill === 'conic-gradient') {
    const stops = paint.stops.map(stopXml).join('');
    const P = WEASEL_NS_PREFIX;
    return (
      `<${P}:conicGradient id="${id}" gradientUnits="${gradientUnitsAttr(paint.units)}" ` +
      `cx="${trimNumber(paint.center.x)}" cy="${trimNumber(paint.center.y)}" ` +
      `angle="${trimNumber(paint.angle)}"` +
      `${interpolateAttr(paint.interpolate)}>${stops}</${P}:conicGradient>`
    );
  }
  if (paint.fill === 'radial-gradient') {
    const stops = paint.stops.map(stopXml).join('');
    return (
      `<radialGradient id="${id}" gradientUnits="${gradientUnitsAttr(paint.units)}" ` +
      `cx="${trimNumber(paint.center.x)}" cy="${trimNumber(paint.center.y)}" ` +
      `r="${trimNumber(paint.radius)}"` +
      `${interpolateAttr(paint.interpolate)}>${stops}</radialGradient>`
    );
  }
  return '';
}

/**
 * The color a renderer that cannot resolve the reference should paint. `none`
 * when the paint has no single color to name — nothing painted is at least
 * honest, where an invented black is not.
 */
function paintFallback(paint: FillStyle): string {
  const color = getPaintKind(paint.fill)?.colorOf(paint);
  if (!color) return 'none';
  // Whoever reads the fallback is by definition an older renderer, so the
  // packed alpha comes off rather than riding out as an 8-digit hex.
  const packed = /^#([0-9a-f]{6})[0-9a-f]{2}$/i.exec(color);
  return packed ? `#${packed[1].toLowerCase()}` : color;
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
