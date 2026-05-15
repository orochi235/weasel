/**
 * Map between SVG `<linearGradient>` / `<radialGradient>` elements and
 * weasel's `FillStyle` gradient variants. We collect gradients from
 * `<defs>` during parse and look them up by id when a `fill` /
 * `stroke` attribute references one as `url(#id)`. On serialize, we
 * emit a fresh `<defs>` block with stable generated ids.
 */

import type { FillStyle, GradStop } from '@orochi235/weasel';
import { parsePaintAttr } from './color';
import { trimNumber } from './transform';

/** Collected gradient definitions, keyed by element id. */
export type GradientTable = Map<string, FillStyle>;

/** Read the children of `<defs>` and extract supported gradient nodes. */
export function collectGradients(svg: Element, onWarn?: (m: string) => void): GradientTable {
  const out: GradientTable = new Map();
  const defs = svg.getElementsByTagName('defs');
  for (let d = 0; d < defs.length; d++) {
    const root = defs[d];
    for (let i = 0; i < root.children.length; i++) {
      const child = root.children[i];
      const tag = child.tagName.toLowerCase();
      const id = child.getAttribute('id');
      if (!id) continue;
      if (tag === 'lineargradient') {
        const paint = readLinearGradient(child, onWarn);
        if (paint) out.set(id, paint);
      } else if (tag === 'radialgradient') {
        const paint = readRadialGradient(child, onWarn);
        if (paint) out.set(id, paint);
      } else if (tag !== 'lineargradient' && tag !== 'radialgradient') {
        onWarn?.(`unsupported <defs> child: <${child.tagName}>`);
      }
    }
  }
  return out;
}

function readStops(el: Element, onWarn?: (m: string) => void): GradStop[] {
  const stops: GradStop[] = [];
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i];
    if (c.tagName.toLowerCase() !== 'stop') continue;
    const offsetRaw = c.getAttribute('offset') ?? '0';
    const offset = offsetRaw.endsWith('%')
      ? parseFloat(offsetRaw) / 100
      : parseFloat(offsetRaw);
    const colorAttr = c.getAttribute('stop-color') ?? '#000000';
    const parsed = parsePaintAttr(colorAttr);
    if (parsed && parsed.kind === 'solid') {
      const opacityAttr = c.getAttribute('stop-opacity');
      const alpha = opacityAttr != null ? parseFloat(opacityAttr) : parsed.alpha;
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

function readLinearGradient(el: Element, onWarn?: (m: string) => void): FillStyle | null {
  const x1 = parseFloat(el.getAttribute('x1') ?? '0');
  const y1 = parseFloat(el.getAttribute('y1') ?? '0');
  const x2 = parseFloat(el.getAttribute('x2') ?? '1');
  const y2 = parseFloat(el.getAttribute('y2') ?? '0');
  const stops = readStops(el, onWarn);
  return {
    fill: 'linear-gradient',
    from: { x: x1, y: y1 },
    to: { x: x2, y: y2 },
    stops,
  };
}

function readRadialGradient(el: Element, onWarn?: (m: string) => void): FillStyle | null {
  const cx = parseFloat(el.getAttribute('cx') ?? '0.5');
  const cy = parseFloat(el.getAttribute('cy') ?? '0.5');
  const r = parseFloat(el.getAttribute('r') ?? '0.5');
  const stops = readStops(el, onWarn);
  return {
    fill: 'radial-gradient',
    center: { x: cx, y: cy },
    radius: r,
    stops,
  };
}

/**
 * Pre-pass that assigns stable serialization ids to gradients used by
 * any leaf in the tree. We key on object identity so two leaves sharing
 * the exact same `FillStyle` reference reuse one `<defs>` entry; structurally
 * equal but distinct objects get separate ids.
 */
export class GradientRegistry {
  private byPaint = new Map<FillStyle, string>();
  private order: FillStyle[] = [];
  private counter = 0;

  register(paint: FillStyle): string {
    const existing = this.byPaint.get(paint);
    if (existing) return existing;
    const id = `grad${this.counter++}`;
    this.byPaint.set(paint, id);
    this.order.push(paint);
    return id;
  }

  /** Emit `<defs>...</defs>` XML for all registered gradients. */
  toDefsXml(): string {
    if (this.order.length === 0) return '';
    const parts: string[] = ['<defs>'];
    for (const paint of this.order) {
      const id = this.byPaint.get(paint)!;
      parts.push(gradientXml(id, paint));
    }
    parts.push('</defs>');
    return parts.join('');
  }
}

function gradientXml(id: string, paint: FillStyle): string {
  if (paint.fill === 'linear-gradient') {
    const stops = paint.stops.map(stopXml).join('');
    return (
      `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" ` +
      `x1="${trimNumber(paint.from.x)}" y1="${trimNumber(paint.from.y)}" ` +
      `x2="${trimNumber(paint.to.x)}" y2="${trimNumber(paint.to.y)}">${stops}</linearGradient>`
    );
  }
  if (paint.fill === 'radial-gradient') {
    const stops = paint.stops.map(stopXml).join('');
    return (
      `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" ` +
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
