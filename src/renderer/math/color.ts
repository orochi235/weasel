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
