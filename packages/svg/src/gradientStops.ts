/** A gradient element's own `<stop>`s, read as SVG resolves them. */
import type { GradStop } from '@weasel-js/core';
import { ownProp, ownValue } from './cascade';
import { readProperty } from './properties';

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
