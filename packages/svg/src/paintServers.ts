import { pathToD } from '@weasel-js/geom';
import { getPaintKind, nativeSvgKind } from '@weasel-js/paint-kinds';
import { getMarker, isPatternPaint } from '@weasel-js/core';
import type { Paint, MarkerRef, Path } from '@weasel-js/core';
import { gradientXml, usesInterpolateAttr } from './gradients';
import { patternXml } from './patterns';
import { defUsesPrivateNamespace, markerDefOf, markerDefXml, type MarkerDef } from './markerDefs';

function hasNativeSvgForm(paint: Paint): boolean {
  return nativeSvgKind(paint.kind ?? 'solid');
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
