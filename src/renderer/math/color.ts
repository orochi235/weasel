/**
 * Parse a CSS color string into [r, g, b, a] with 0..1 components.
 *
 * Supported forms:
 *   - Hex: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` (any case)
 *   - `rgb()` / `rgba()` with integer, float, or percent R/G/B; number or
 *     percent alpha; commas or modern space-separated `R G B / A` syntax
 *   - `hsl()` / `hsla()` with hue as a unitless number (deg) or with `deg`,
 *     `rad`, `grad`, `turn` units; saturation/lightness as percent (or
 *     unitless in the modern syntax); same alpha rules and separator rules
 *     as `rgb()`
 *   - The 148 CSS named colors plus `transparent`
 *
 * Not supported: `oklch()`, `lab()`, `color()`, `currentColor`, system
 * colors. Throws on anything unrecognized.
 *
 * Results are cached by input-string identity. Callers MUST treat the
 * returned tuple as read-only — mutation would corrupt the cache.
 */
export function parseColor(input: string): [number, number, number, number] {
  const cached = CACHE.get(input);
  if (cached !== undefined) return cached;
  const result = parseColorUncached(input);
  if (CACHE.size >= CACHE_MAX) CACHE.clear();
  CACHE.set(input, result);
  return result;
}

const CACHE = new Map<string, [number, number, number, number]>();
const CACHE_MAX = 1024;

function parseColorUncached(input: string): [number, number, number, number] {
  const s = input.trim();
  if (s.startsWith('#')) return parseHex(s);

  const lower = s.toLowerCase();

  // Named colors and `transparent` are checked before fn() forms because the
  // fn() regexes won't match them anyway and the lookup is cheaper than a
  // failed regex match.
  const named = NAMED_COLORS[lower];
  if (named !== undefined) return named;

  if (lower.startsWith('rgb')) {
    const parsed = parseRgbFunction(lower);
    if (parsed) return parsed;
  }
  if (lower.startsWith('hsl')) {
    const parsed = parseHslFunction(lower);
    if (parsed) return parsed;
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

/**
 * Canonicalize a hex color string to lowercase `#rrggbb` or `#rrggbbaa`.
 *
 * Accepts: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, with or without the
 * leading `#`, any case. Throws on other inputs.
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
  if (body.length === 4) {
    return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}${body[3]}${body[3]}`;
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
    return [
      parseInt(hex[0] + hex[0], 16) / 255,
      parseInt(hex[1] + hex[1], 16) / 255,
      parseInt(hex[2] + hex[2], 16) / 255,
      1,
    ];
  }
  if (hex.length === 4) {
    return [
      parseInt(hex[0] + hex[0], 16) / 255,
      parseInt(hex[1] + hex[1], 16) / 255,
      parseInt(hex[2] + hex[2], 16) / 255,
      parseInt(hex[3] + hex[3], 16) / 255,
    ];
  }
  if (hex.length === 6) {
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
      1,
    ];
  }
  if (hex.length === 8) {
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
      parseInt(hex.slice(6, 8), 16) / 255,
    ];
  }
  throw new Error(`parseColor: invalid hex "${s}"`);
}

/** Match `name( body )` and return the trimmed body, or null. */
function unwrapFn(s: string, name: string): string | null {
  if (!s.startsWith(name + '(') || !s.endsWith(')')) return null;
  return s.slice(name.length + 1, -1).trim();
}

/**
 * Split a function body into the value tokens (3 channels + optional alpha).
 * Supports both legacy `r, g, b[, a]` and modern `r g b[ / a]` separators.
 * Returns null if the token count is wrong.
 */
function splitChannels(body: string): { rgb: [string, string, string]; alpha: string | null } | null {
  if (body.includes(',')) {
    const parts = body.split(',').map((p) => p.trim());
    if (parts.length !== 3 && parts.length !== 4) return null;
    return {
      rgb: [parts[0], parts[1], parts[2]],
      alpha: parts.length === 4 ? parts[3] : null,
    };
  }
  // Modern syntax: whitespace-separated, with optional `/ alpha` tail.
  const slash = body.indexOf('/');
  const head = (slash === -1 ? body : body.slice(0, slash)).trim();
  const alpha = slash === -1 ? null : body.slice(slash + 1).trim();
  const parts = head.split(/\s+/);
  if (parts.length !== 3) return null;
  if (alpha !== null && alpha === '') return null;
  return { rgb: [parts[0], parts[1], parts[2]], alpha };
}

/** Parse a channel value: integer, float, or percent. Returns 0..1 (with `max` as the integer scale). */
function parseChannel(tok: string, max: number): number | null {
  if (tok.endsWith('%')) {
    const n = Number(tok.slice(0, -1));
    if (!Number.isFinite(n)) return null;
    return clamp01(n / 100);
  }
  const n = Number(tok);
  if (!Number.isFinite(n)) return null;
  return clamp01(n / max);
}

/** Alpha may be a number 0..1 or a percent. */
function parseAlpha(tok: string | null): number {
  if (tok === null) return 1;
  if (tok.endsWith('%')) {
    const n = Number(tok.slice(0, -1));
    return Number.isFinite(n) ? clamp01(n / 100) : 1;
  }
  const n = Number(tok);
  return Number.isFinite(n) ? clamp01(n) : 1;
}

function parseRgbFunction(s: string): [number, number, number, number] | null {
  const body = unwrapFn(s, 'rgba') ?? unwrapFn(s, 'rgb');
  if (body === null) return null;
  const channels = splitChannels(body);
  if (!channels) return null;
  const r = parseChannel(channels.rgb[0], 255);
  const g = parseChannel(channels.rgb[1], 255);
  const b = parseChannel(channels.rgb[2], 255);
  if (r === null || g === null || b === null) return null;
  return [r, g, b, parseAlpha(channels.alpha)];
}

function parseHslFunction(s: string): [number, number, number, number] | null {
  const body = unwrapFn(s, 'hsla') ?? unwrapFn(s, 'hsl');
  if (body === null) return null;
  const channels = splitChannels(body);
  if (!channels) return null;
  const h = parseHue(channels.rgb[0]);
  const sat = parsePercentOrNumber(channels.rgb[1]);
  const lit = parsePercentOrNumber(channels.rgb[2]);
  if (h === null || sat === null || lit === null) return null;
  const [r, g, b] = hslToRgb(h, sat, lit);
  return [r, g, b, parseAlpha(channels.alpha)];
}

/** Parse a hue token: `<number>`, `<number>deg`, `<number>rad`, `<number>grad`, `<number>turn`. Returns degrees 0..360 (modulo). */
function parseHue(tok: string): number | null {
  let n: number;
  if (tok.endsWith('deg')) n = Number(tok.slice(0, -3));
  else if (tok.endsWith('grad')) n = Number(tok.slice(0, -4)) * 0.9; // 400grad = 360deg
  else if (tok.endsWith('rad')) n = Number(tok.slice(0, -3)) * (180 / Math.PI);
  else if (tok.endsWith('turn')) n = Number(tok.slice(0, -4)) * 360;
  else n = Number(tok);
  if (!Number.isFinite(n)) return null;
  return ((n % 360) + 360) % 360;
}

/** Saturation/lightness may be percent (CSS Color 3) or unitless number 0..1 (modern). */
function parsePercentOrNumber(tok: string): number | null {
  if (tok.endsWith('%')) {
    const n = Number(tok.slice(0, -1));
    return Number.isFinite(n) ? clamp01(n / 100) : null;
  }
  const n = Number(tok);
  return Number.isFinite(n) ? clamp01(n) : null;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  return [hueToChannel(p, q, hk + 1 / 3), hueToChannel(p, q, hk), hueToChannel(p, q, hk - 1 / 3)];
}

function hueToChannel(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

// CSS Color Module Level 4 named colors. Stored as already-resolved tuples so
// lookup is O(1) and avoids a second parse hop.
const NAMED_COLORS: Record<string, [number, number, number, number]> = (() => {
  const hex: Record<string, number> = {
    aliceblue: 0xf0f8ff, antiquewhite: 0xfaebd7, aqua: 0x00ffff, aquamarine: 0x7fffd4,
    azure: 0xf0ffff, beige: 0xf5f5dc, bisque: 0xffe4c4, black: 0x000000,
    blanchedalmond: 0xffebcd, blue: 0x0000ff, blueviolet: 0x8a2be2, brown: 0xa52a2a,
    burlywood: 0xdeb887, cadetblue: 0x5f9ea0, chartreuse: 0x7fff00, chocolate: 0xd2691e,
    coral: 0xff7f50, cornflowerblue: 0x6495ed, cornsilk: 0xfff8dc, crimson: 0xdc143c,
    cyan: 0x00ffff, darkblue: 0x00008b, darkcyan: 0x008b8b, darkgoldenrod: 0xb8860b,
    darkgray: 0xa9a9a9, darkgreen: 0x006400, darkgrey: 0xa9a9a9, darkkhaki: 0xbdb76b,
    darkmagenta: 0x8b008b, darkolivegreen: 0x556b2f, darkorange: 0xff8c00, darkorchid: 0x9932cc,
    darkred: 0x8b0000, darksalmon: 0xe9967a, darkseagreen: 0x8fbc8f, darkslateblue: 0x483d8b,
    darkslategray: 0x2f4f4f, darkslategrey: 0x2f4f4f, darkturquoise: 0x00ced1, darkviolet: 0x9400d3,
    deeppink: 0xff1493, deepskyblue: 0x00bfff, dimgray: 0x696969, dimgrey: 0x696969,
    dodgerblue: 0x1e90ff, firebrick: 0xb22222, floralwhite: 0xfffaf0, forestgreen: 0x228b22,
    fuchsia: 0xff00ff, gainsboro: 0xdcdcdc, ghostwhite: 0xf8f8ff, gold: 0xffd700,
    goldenrod: 0xdaa520, gray: 0x808080, green: 0x008000, greenyellow: 0xadff2f,
    grey: 0x808080, honeydew: 0xf0fff0, hotpink: 0xff69b4, indianred: 0xcd5c5c,
    indigo: 0x4b0082, ivory: 0xfffff0, khaki: 0xf0e68c, lavender: 0xe6e6fa,
    lavenderblush: 0xfff0f5, lawngreen: 0x7cfc00, lemonchiffon: 0xfffacd, lightblue: 0xadd8e6,
    lightcoral: 0xf08080, lightcyan: 0xe0ffff, lightgoldenrodyellow: 0xfafad2, lightgray: 0xd3d3d3,
    lightgreen: 0x90ee90, lightgrey: 0xd3d3d3, lightpink: 0xffb6c1, lightsalmon: 0xffa07a,
    lightseagreen: 0x20b2aa, lightskyblue: 0x87cefa, lightslategray: 0x778899, lightslategrey: 0x778899,
    lightsteelblue: 0xb0c4de, lightyellow: 0xffffe0, lime: 0x00ff00, limegreen: 0x32cd32,
    linen: 0xfaf0e6, magenta: 0xff00ff, maroon: 0x800000, mediumaquamarine: 0x66cdaa,
    mediumblue: 0x0000cd, mediumorchid: 0xba55d3, mediumpurple: 0x9370db, mediumseagreen: 0x3cb371,
    mediumslateblue: 0x7b68ee, mediumspringgreen: 0x00fa9a, mediumturquoise: 0x48d1cc, mediumvioletred: 0xc71585,
    midnightblue: 0x191970, mintcream: 0xf5fffa, mistyrose: 0xffe4e1, moccasin: 0xffe4b5,
    navajowhite: 0xffdead, navy: 0x000080, oldlace: 0xfdf5e6, olive: 0x808000,
    olivedrab: 0x6b8e23, orange: 0xffa500, orangered: 0xff4500, orchid: 0xda70d6,
    palegoldenrod: 0xeee8aa, palegreen: 0x98fb98, paleturquoise: 0xafeeee, palevioletred: 0xdb7093,
    papayawhip: 0xffefd5, peachpuff: 0xffdab9, peru: 0xcd853f, pink: 0xffc0cb,
    plum: 0xdda0dd, powderblue: 0xb0e0e6, purple: 0x800080, rebeccapurple: 0x663399,
    red: 0xff0000, rosybrown: 0xbc8f8f, royalblue: 0x4169e1, saddlebrown: 0x8b4513,
    salmon: 0xfa8072, sandybrown: 0xf4a460, seagreen: 0x2e8b57, seashell: 0xfff5ee,
    sienna: 0xa0522d, silver: 0xc0c0c0, skyblue: 0x87ceeb, slateblue: 0x6a5acd,
    slategray: 0x708090, slategrey: 0x708090, snow: 0xfffafa, springgreen: 0x00ff7f,
    steelblue: 0x4682b4, tan: 0xd2b48c, teal: 0x008080, thistle: 0xd8bfd8,
    tomato: 0xff6347, turquoise: 0x40e0d0, violet: 0xee82ee, wheat: 0xf5deb3,
    white: 0xffffff, whitesmoke: 0xf5f5f5, yellow: 0xffff00, yellowgreen: 0x9acd32,
  };
  const out: Record<string, [number, number, number, number]> = {
    transparent: [0, 0, 0, 0],
  };
  for (const name in hex) {
    const n = hex[name];
    out[name] = [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255, 1];
  }
  return out;
})();
