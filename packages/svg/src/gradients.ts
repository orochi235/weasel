/**
 * Map between SVG `<linearGradient>` / `<radialGradient>` elements and
 * weasel's `Paint` gradient variants. Definitions are indexed by id
 * wherever in the document they appear, and looked up when a `fill` /
 * `stroke` attribute references one as `url(#id)`. On serialize, we
 * emit a fresh `<defs>` block with stable generated ids.
 */

import { pathToD } from '@weasel-js/geom';
import { getPaintKind, getMarker, isPatternPaint, isTileKind } from '@weasel-js/core';
import type {
  Paint, GradStop, PaintUnits, MarkerRef, Path,
} from '@weasel-js/core';
import { parseRatio, readStops, stopsXml } from './gradientStops';
import { trimNumber } from './transform';
import { resolveLength, type LengthAxis } from './lengths';
import { patternXml } from './patterns';
import { collectElementsByTag, type ElementTable } from './elements';
import { SUPPORTED_LEAF_TAGS } from './lowerLeaf';
import { defUsesPrivateNamespace, markerDefOf, markerDefXml, type MarkerDef } from './markerDefs';

/** Collected gradient definitions, keyed by element id. */
export type GradientTable = Map<string, Paint>;

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
/** Whether SVG has its own paint server for paint kind `kind`: solids, the
 *  linear and radial gradients, and patterns. Any other kind is written in
 *  weasel's namespace with a fallback color, which other renderers paint flat. */
export function nativeSvgKind(kind: string): boolean {
  return kind === 'solid' || kind === 'linear-gradient' || kind === 'radial-gradient' || kind === 'texture' || kind === 'image' || isTileKind(kind);
}

function hasNativeSvgForm(paint: Paint): boolean {
  return nativeSvgKind(paint.kind ?? 'solid');
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

/** Whether a gradient interpolating through `space` blends the same in every
 *  SVG renderer — only sRGB, the default. A perceptual space still exports,
 *  but renderers other than weasel blend it in sRGB. */
export function nativeSvgSpace(space: string | null | undefined): boolean {
  return !space || space === 'rgb';
}

/** The `wzl:interpolate` attribute a gradient needs, or `''` for the sRGB
 *  default every other renderer already assumes. */
function interpolateAttr(space: string | undefined): string {
  if (nativeSvgSpace(space)) return '';
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
function usesInterpolateAttr(paint: Paint): boolean {
  const space = (paint as { interpolate?: string }).interpolate;
  return !nativeSvgSpace(space) && INTERPOLATE_SPACES.has(space!);
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

/**
 * Pre-pass that assigns stable serialization ids to the paint servers —
 * gradients and patterns — used by any leaf in the tree. We key on object
 * identity so two leaves sharing the exact same `Paint` reference reuse
 * one `<defs>` entry; structurally equal but distinct objects get separate
 * ids.
 */
export class PaintServerRegistry {
  private byPaint = new Map<Paint, string>();
  private order: Paint[] = [];
  private counter = 0;

  // Marker defs referenced by any stroke, by `<defs>` id in first-use order;
  // `markerDefOf` says what each id is.
  private markers = new Map<string, MarkerDef>();
  // Whether an element was written with a `wzl:` attribute of its own.
  private privateAttrs = false;

  // Clip paths, in first-use order. Identity, not value: two groups clipped by
  // equal outlines get a def each, which costs bytes and misleads nobody.
  private clips: Path[] = [];
  private clipIds = new Map<Path, string>();

  register(paint: Paint): string {
    const existing = this.byPaint.get(paint);
    if (existing) return existing;
    const id = isPatternPaint(paint) ? `pat${this.counter++}` : `grad${this.counter++}`;
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
  ref(paint: Paint): string {
    const id = this.register(paint);
    if (hasNativeSvgForm(paint)) return `url(#${id})`;
    return `url(#${id}) ${paintFallback(paint)}`;
  }

  /** The paint kind of each registered paint, once, in first-use order. */
  paintKinds(): string[] {
    return [...new Set(this.order.map((paint) => paint.kind ?? 'solid'))];
  }

  /** Whether any registered paint serializes outside SVG's own vocabulary, so
   *  the root has to declare {@link WEASEL_NS}. */
  usesPrivateNamespace(): boolean {
    return this.order.some((paint) => !hasNativeSvgForm(paint) || usesInterpolateAttr(paint))
      || this.privateAttrs || [...this.markers.values()].some(defUsesPrivateNamespace);
  }

  /** Note that the body uses the private namespace for an attribute of its own. */
  usePrivateNamespace(): void {
    this.privateAttrs = true;
  }

  /** The `<defs>` id for a marker reference, `seated` for a start or end head
   *  the line was cut back for. `undefined` when nothing is registered under
   *  the key, so a caller emits no attribute at all rather than a `url(#…)`
   *  pointing at a def that will never be written. */
  markerId(ref: MarkerRef, seated = false): string | undefined {
    if (getMarker(typeof ref === 'string' ? ref : ref.key) === undefined) return undefined;
    const { id, def } = markerDefOf(ref, seated);
    if (!this.markers.has(id)) this.markers.set(id, def);
    return id;
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
    if (this.order.length === 0 && this.markers.size === 0 && this.clips.length === 0) {
      return '';
    }
    const parts: string[] = ['<defs>'];
    for (const paint of this.order) {
      parts.push(paintServerXml(this.byPaint.get(paint)!, paint, onWarn));
    }
    for (const [id, def] of this.markers) {
      const entry = getMarker(def.key);
      if (!entry) continue;
      if (entry.toSvg) {
        if (def.size !== undefined) onWarn?.(`marker "${def.key}" writes its own <marker> def, which cannot carry a reference's size; written at its own size`);
        parts.push(entry.toSvg(id, entry));
      } else {
        parts.push(markerDefXml(id, entry, def, onWarn));
      }
    }
    for (const path of this.clips) {
      parts.push(
        `<clipPath id="${this.clipIds.get(path)!}">`
        + `<path d="${pathToD(path)}"${path.kind === 'polygon' && path.fillRule === 'evenodd' ? ' clip-rule="evenodd"' : ''}/>`
        + '</clipPath>',
      );
    }
    parts.push('</defs>');
    return parts.join('');
  }
}

/** One paint server's `<defs>` entry: the built-in mapping, else the kind's
 *  own `toSvg`, else nothing plus a warning. The referencing element already
 *  carries `fill="url(#id)"`, so a silent omission is a dangling reference and
 *  the shape vanishes in a viewer. */
function paintServerXml(id: string, paint: Paint, onWarn?: (m: string) => void): string {
  if (isPatternPaint(paint)) return patternXml(id, paint, onWarn);
  const builtin = gradientXml(id, paint);
  if (builtin) return builtin;
  const kind = getPaintKind(paint.kind);
  const custom = kind?.toSvg?.(id, paint);
  if (custom) return custom;
  onWarn?.(kind
    ? `${paint.kind} fill has no vector form — omitted from <defs>`
    : `${paint.kind} fill is not registered — omitted from <defs>; a kind loaded on demand needs \`await warmSvg(nodes)\` before a synchronous export`);
  return '';
}

/** `PaintUnits` → SVG `gradientUnits`. `'screen'` (the kit's default, and
 *  a viewport-fixed wash) has no SVG analog at all; it lowers to user space,
 *  which at least puts the paint somewhere the geometry is. */
function gradientUnitsAttr(units: PaintUnits | undefined): string {
  return units === 'bounds' ? 'objectBoundingBox' : 'userSpaceOnUse';
}

function gradientXml(id: string, paint: Paint): string {
  if (paint.kind === 'linear-gradient') {
    const stops = stopsXml(paint.stops, paint.interpolate);
    return (
      `<linearGradient id="${id}" gradientUnits="${gradientUnitsAttr(paint.units)}" ` +
      `x1="${trimNumber(paint.from.x)}" y1="${trimNumber(paint.from.y)}" ` +
      `x2="${trimNumber(paint.to.x)}" y2="${trimNumber(paint.to.y)}"` +
      `${interpolateAttr(paint.interpolate)}>${stops}</linearGradient>`
    );
  }
  if (paint.kind === 'conic-gradient') {
    const stops = stopsXml(paint.stops, paint.interpolate);
    const P = WEASEL_NS_PREFIX;
    return (
      `<${P}:conicGradient id="${id}" gradientUnits="${gradientUnitsAttr(paint.units)}" ` +
      `cx="${trimNumber(paint.center.x)}" cy="${trimNumber(paint.center.y)}" ` +
      `angle="${trimNumber(paint.angle)}"` +
      `${interpolateAttr(paint.interpolate)}>${stops}</${P}:conicGradient>`
    );
  }
  if (paint.kind === 'radial-gradient') {
    const stops = stopsXml(paint.stops, paint.interpolate);
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
function paintFallback(paint: Paint): string {
  const color = getPaintKind(paint.kind)?.colorOf(paint);
  if (!color) return 'none';
  // Whoever reads the fallback is by definition an older renderer, so the
  // packed alpha comes off rather than riding out as an 8-digit hex.
  const packed = /^#([0-9a-f]{6})[0-9a-f]{2}$/i.exec(color);
  return packed ? `#${packed[1].toLowerCase()}` : color;
}
