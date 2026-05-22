/**
 * Parse a CSS color string into [r, g, b, a] with 0..1 components.
 *
 * Supported forms:
 *   - `#rgb`, `#rrggbb`, `#rrggbbaa`
 *   - `rgb(r, g, b)`, `rgba(r, g, b, a)` with integer 0..255 RGB and 0..1 alpha
 *
 * Named colors (e.g. `red`, `transparent`) are NOT supported in step 1;
 * use a CSS-parsing helper or hex equivalents. Adding named colors later
 * means wiring up `<canvas>.getContext('2d').fillStyle` lookup, which
 * requires a DOM and is deferred.
 */
export function parseColor(input: string): [number, number, number, number] {
  const s = input.trim();
  if (s.startsWith('#')) return parseHex(s);
  const rgbMatch = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (rgbMatch) {
    return [
      Number(rgbMatch[1]) / 255,
      Number(rgbMatch[2]) / 255,
      Number(rgbMatch[3]) / 255,
      rgbMatch[4] !== undefined ? Number(rgbMatch[4]) : 1,
    ];
  }
  throw new Error(`parseColor: unrecognized color "${input}"`);
}

const RESOLVE_COLOR_CACHE_CAP = 1024;
const resolveColorCache = new Map<string, readonly [number, number, number, number]>();

/** Cached `parseColor`. Use this from renderer hot paths (per-frame draw
 *  callbacks, gradient ramp builds) so repeated color strings — which are
 *  common when many objects share a fill — don't re-tokenize each frame.
 *
 *  Cache is keyed by input-string identity, capped at ~1024 entries, and
 *  cleared wholesale on overflow (no LRU tracking — simple is fine since
 *  the working set in any one app is typically much smaller than the cap). */
export function resolveColor(input: string): readonly [number, number, number, number] {
  const hit = resolveColorCache.get(input);
  if (hit) return hit;
  if (resolveColorCache.size >= RESOLVE_COLOR_CACHE_CAP) {
    resolveColorCache.clear();
  }
  const parsed = parseColor(input);
  const frozen = parsed as readonly [number, number, number, number];
  resolveColorCache.set(input, frozen);
  return frozen;
}

/** @internal Test-only: drops the resolveColor memoization cache so tests
 *  can assert behavior in isolation. Never call from production code. */
export function __resetResolveColorCache(): void {
  resolveColorCache.clear();
}

/** Same as `parseColor` but returns integer 0..255 components. */
export function parseColorToRgba255(input: string): [number, number, number, number] {
  const [r, g, b, a] = parseColor(input);
  return [
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(b * 255),
    Math.round(a * 255),
  ];
}

/**
 * Canonicalize a hex color string to lowercase `#rrggbb` or `#rrggbbaa`.
 *
 * Accepts: `#rgb`, `#rrggbb`, `#rrggbbaa`, with or without the leading `#`,
 * any case. Throws on other inputs.
 */
export function normalizeHex(input: string): string {
  const trimmed = input.trim();
  const body = (trimmed.startsWith('#') ? trimmed.slice(1) : trimmed).toLowerCase();
  if (!/^[0-9a-f]+$/.test(body)) {
    throw new Error(`normalizeHex: invalid hex "${input}"`);
  }
  if (body.length === 3) {
    return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`;
  }
  if (body.length === 6 || body.length === 8) {
    return `#${body}`;
  }
  throw new Error(`normalizeHex: invalid hex "${input}"`);
}

/**
 * Parse a hex color into [r, g, b, a] with 0..1 components. Accepts the same
 * forms as `normalizeHex`, including a missing leading `#`.
 */
export function hexToRgba(input: string): [number, number, number, number] {
  return parseHex(normalizeHex(input));
}

/**
 * Format [r, g, b, a] (0..1 components) as a hex string. Emits `#rrggbb` when
 * alpha is exactly 1 (or omitted), otherwise `#rrggbbaa`.
 */
export function rgbaToHex(rgba: readonly [number, number, number, number] | readonly [number, number, number]): string {
  const [r, g, b] = rgba;
  const a = rgba.length === 4 ? rgba[3] : 1;
  const f = (n: number) => Math.max(0, Math.min(255, Math.round(n * 255))).toString(16).padStart(2, '0');
  const base = `#${f(r)}${f(g)}${f(b)}`;
  return a >= 1 ? base : `${base}${f(a)}`;
}

function parseHex(s: string): [number, number, number, number] {
  const hex = s.slice(1);
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16) / 255;
    const g = parseInt(hex[1] + hex[1], 16) / 255;
    const b = parseInt(hex[2] + hex[2], 16) / 255;
    return [r, g, b, 1];
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    return [r, g, b, 1];
  }
  if (hex.length === 8) {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const a = parseInt(hex.slice(6, 8), 16) / 255;
    return [r, g, b, a];
  }
  throw new Error(`parseColor: invalid hex "${s}"`);
}
