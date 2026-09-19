/**
 * A resolved color at `alpha`, multiplied into any alpha it already carries. The
 * JS side of the alpha extension; the CSS side emits `color-mix()` instead so DOM
 * chrome keeps tracking a downstream override of the referenced token.
 *
 * Hex and `rgb()`/`rgba()` become an `rgba()` literal. Anything else — a named
 * color, `hsl()`, `oklch()`, a `var()` — becomes the same `color-mix()` the CSS
 * side writes, which the browser resolves.
 */
export function withAlpha(color: string, alpha: number): string {
  const rgba = parseRgba(color.trim());
  if (!rgba) return `color-mix(in srgb, ${color.trim()} ${round(alpha * 100, 4)}%, transparent)`;
  const [r, g, b, a] = rgba;
  return `rgba(${r}, ${g}, ${b}, ${round(a * alpha, 3)})`;
}

type Rgba = [number, number, number, number];

function round(n: number, places: number): number {
  return Number(n.toFixed(places));
}

function parseRgba(s: string): Rgba | null {
  if (s.toLowerCase() === 'transparent') return [0, 0, 0, 0];
  return parseHex(s) ?? parseRgbFn(s);
}

function parseHex(s: string): Rgba | null {
  const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
  if (!m) return null;
  const body = m[1];
  const full = body.length <= 4 ? body.replace(/./g, (c) => c + c) : body;
  const byte = (i: number) => Number.parseInt(full.slice(i, i + 2), 16);
  return [byte(0), byte(2), byte(4), full.length === 8 ? byte(6) / 255 : 1];
}

function parseRgbFn(s: string): Rgba | null {
  const m = /^rgba?\(([^()]*)\)$/i.exec(s);
  if (!m) return null;
  const [channels, alphaPart, extra] = m[1].split('/');
  if (extra !== undefined) return null;
  const parts = channels.trim().split(/\s*,\s*|\s+/);
  if (alphaPart !== undefined) parts.push(alphaPart.trim());
  if (parts.length !== 3 && parts.length !== 4) return null;

  const channel = (p: string) => (p.endsWith('%') ? (Number.parseFloat(p) / 100) * 255 : Number(p));
  const alpha = (p: string) => (p.endsWith('%') ? Number.parseFloat(p) / 100 : Number(p));
  const [r, g, b] = parts.slice(0, 3).map(channel);
  const a = parts[3] === undefined ? 1 : alpha(parts[3]);
  if (![r, g, b, a].every(Number.isFinite)) return null;
  return [Math.round(r), Math.round(g), Math.round(b), a];
}
