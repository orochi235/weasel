/**
 * SVG color / paint parsing. Handles the common surface: hex shorthands,
 * `rgb()` / `rgba()` functional notation, the SVG named-color table, the
 * sentinel `none`, and `url(#id)` paint-server references. Output is
 * normalized to `#rrggbb` plus an optional 0..1 alpha so the rest of the
 * pipeline doesn't have to know about the encoding variants.
 */

/** Result of parsing a `fill=` / `stroke=` attribute value. */
export type ParsedColor =
  | { kind: 'none' }
  | { kind: 'solid'; color: string; alpha: number }
  | { kind: 'ref'; id: string };

const NAMED_COLORS: Record<string, string> = {
  // SVG/CSS named-color subset. The full table is ~150 entries; we cover
  // the most common ones inline and treat the rest as warnings at the
  // call site if needed. Add aggressively as fixtures demand.
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
  blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff',
  gray: '#808080', grey: '#808080', silver: '#c0c0c0', maroon: '#800000',
  olive: '#808000', purple: '#800080', teal: '#008080', navy: '#000080',
  orange: '#ffa500', pink: '#ffc0cb', brown: '#a52a2a', transparent: '#00000000',
  lime: '#00ff00', aqua: '#00ffff', fuchsia: '#ff00ff',
};

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

function toHex2(n: number): string {
  const v = clamp(Math.round(n), 0, 255);
  return v.toString(16).padStart(2, '0');
}

/**
 * Parse an SVG paint string. Returns `null` for inputs we don't recognize
 * (so the caller can emit a warning and fall back). `currentColor` resolves
 * to black — weasel-svg doesn't track CSS context.
 */
export function parsePaintAttr(raw: string | null | undefined): ParsedColor | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (s === '') return null;
  if (s === 'none') return { kind: 'none' };
  if (s === 'currentColor' || s === 'currentcolor') {
    return { kind: 'solid', color: '#000000', alpha: 1 };
  }
  // url(#id) reference.
  const urlMatch = /^url\(\s*#([^)\s]+)\s*\)/.exec(s);
  if (urlMatch) return { kind: 'ref', id: urlMatch[1] };
  // #rrggbb / #rgb / #rrggbbaa / #rgba
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      const r = hex[0] + hex[0];
      const g = hex[1] + hex[1];
      const b = hex[2] + hex[2];
      return { kind: 'solid', color: `#${r}${g}${b}`.toLowerCase(), alpha: 1 };
    }
    if (/^[0-9a-fA-F]{4}$/.test(hex)) {
      const r = hex[0] + hex[0];
      const g = hex[1] + hex[1];
      const b = hex[2] + hex[2];
      const a = parseInt(hex[3] + hex[3], 16) / 255;
      return { kind: 'solid', color: `#${r}${g}${b}`.toLowerCase(), alpha: a };
    }
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return { kind: 'solid', color: `#${hex.toLowerCase()}`, alpha: 1 };
    }
    if (/^[0-9a-fA-F]{8}$/.test(hex)) {
      const a = parseInt(hex.slice(6), 16) / 255;
      return { kind: 'solid', color: `#${hex.slice(0, 6).toLowerCase()}`, alpha: a };
    }
    return null;
  }
  // rgb(...) / rgba(...)
  const rgbMatch = /^rgba?\s*\(([^)]+)\)$/i.exec(s);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(/[,\s]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const parseChan = (p: string): number => {
        if (p.endsWith('%')) return (parseFloat(p) / 100) * 255;
        return parseFloat(p);
      };
      const r = parseChan(parts[0]);
      const g = parseChan(parts[1]);
      const b = parseChan(parts[2]);
      let a = 1;
      if (parts.length >= 4) {
        const p = parts[3];
        a = p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p);
      }
      if ([r, g, b, a].every((n) => Number.isFinite(n))) {
        return {
          kind: 'solid',
          color: `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`,
          alpha: clamp(a, 0, 1),
        };
      }
    }
    return null;
  }
  // Named color.
  const named = NAMED_COLORS[s.toLowerCase()];
  if (named) {
    if (named.length === 9) {
      // transparent → '#00000000'
      return {
        kind: 'solid',
        color: named.slice(0, 7),
        alpha: parseInt(named.slice(7), 16) / 255,
      };
    }
    return { kind: 'solid', color: named, alpha: 1 };
  }
  return null;
}

/** Format a `#rrggbb` plus alpha back into an SVG-friendly attribute value. */
export function formatColor(color: string): string {
  return color;
}
