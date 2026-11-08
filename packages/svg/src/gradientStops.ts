/** A gradient element's own `<stop>`s, read as SVG resolves them, and written so they read back. */
import { sampleGradientStops, type ColorSpace, type GradStop } from '@weasel-js/core';
import { ownProp, ownValue } from './cascade';
import { readProperty } from './properties';
import { trimNumber } from './transform';
import { escapeAttr } from './xmlEscape';

/** Parse a `stop-opacity` / offset value that may carry a `%` suffix. */
export function parseRatio(raw: string): number {
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return NaN;
  return raw.trimEnd().endsWith('%') ? n / 100 : n;
}

export function readStops(el: Element, onWarn?: (m: string) => void): GradStop[] {
  const stops: GradStop[] = [];
  let floor = 0;
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i];
    if (c.tagName.toLowerCase() !== 'stop') continue;
    const offsetRaw = parseRatio(c.getAttribute('offset') ?? '0');
    // SVG clamps an offset to 0..1 and raises one below an earlier stop's to
    // it; the kit sorts its stops, which would put that one first instead.
    const offset = Math.max(floor, Math.min(1, Number.isFinite(offsetRaw) ? offsetRaw : 0));
    floor = offset;
    const colorAttr = ownProp(c, 'stop-color') ?? '#000000';
    const parsed = readProperty('stop-color', colorAttr, onWarn);
    if (parsed) {
      const alpha = (ownValue(c, 'stop-opacity') ?? 1) * parsed.alpha;
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

/**
 * `stops` as SVG reads them back into the ramp the kit paints: in offset order, and with a
 * stop past either end replaced by the color the ramp has there, since SVG clamps an offset
 * to 0..1 and raises one below an earlier stop's.
 */
export function stopsXml(stops: readonly GradStop[], space: ColorSpace | undefined): string {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  const inside = sorted.filter((s) => s.offset >= 0 && s.offset <= 1);
  const at = (offset: number): GradStop => ({ offset, color: sampleGradientStops(sorted, offset, space) });
  const out = [
    ...(sorted.length > 0 && sorted[0].offset < 0 ? [at(0)] : []),
    ...inside,
    ...(sorted.length > 0 && sorted[sorted.length - 1].offset > 1 ? [at(1)] : []),
  ];
  return out.map(stopXml).join('');
}

function stopXml(s: GradStop): string {
  // Detect packed-alpha hex (#rrggbbaa) and split out stop-opacity.
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(s.color);
  if (m) {
    const alpha = parseInt(m[2], 16) / 255;
    return `<stop offset="${trimNumber(s.offset)}" stop-color="#${m[1].toLowerCase()}" stop-opacity="${trimNumber(alpha)}"/>`;
  }
  return `<stop offset="${trimNumber(s.offset)}" stop-color="${escapeAttr(s.color)}"/>`;
}
