import { oklabToSrgbU8, oklchToOklab } from './colorSpaces';

/**
 * A color given directly. `coords` are in the order CSS Color 4 uses for
 * `space` — `srgb` as 0..1 r, g, b; `oklab` as L, a, b; `oklch` as L, C and a
 * hue in degrees. `space` is open: a palette may carry colors in spaces the kit
 * cannot convert, and `colorLiteralToHex` answers `null` for those.
 */
export interface ColorLiteral {
  readonly space: string;
  readonly coords: readonly number[];
  /** 0..1. Omitted means opaque. */
  readonly alpha?: number;
}

/** A color named rather than given: a palette entry, or whatever the resolver's
 *  `external` callback answers to. `index` picks from a sequence entry; a
 *  single-color entry answers only to 0. */
export interface ColorRef {
  readonly ref: string;
  readonly index?: number;
}

/** What a {@link ColorFn} or {@link ColorSeqFn} is handed. */
export interface ColorFnContext {
  /** Resolve any source against the same palette and external lookup. */
  resolve(source: ColorSource): ColorLiteral | null;
}

/** A color computed at resolve time — typically derived from another entry. */
export type ColorFn = (ctx: ColorFnContext) => ColorSource | null | undefined;

export type ColorSource = ColorLiteral | ColorRef | ColorFn;

/** A sequence of colors, read lazily, so it may be endless. A factory rather
 *  than an iterable because a generator object can be iterated only once:
 *  pass the `function*` itself. */
export type ColorSeqFn = (ctx: ColorFnContext) => Iterable<ColorSource>;

export type PaletteEntry =
  | { readonly name: string; readonly color: ColorSource }
  | { readonly name: string; readonly colors: ColorSeqFn };

export interface Palette {
  readonly entries: readonly PaletteEntry[];
}

/** Answers a ref the palette has no entry for. */
export type ExternalColors = (ref: ColorRef) => ColorSource | null | undefined;

type Visit = (s: ColorSource | null | undefined, visiting: ReadonlySet<string>) => ColorLiteral | null;

function nth<T>(items: Iterable<T>, n: number): T | undefined {
  if (!Number.isInteger(n) || n < 0) return undefined;
  let i = 0;
  for (const item of items) if (i++ === n) return item;
  return undefined;
}

const refKey = (name: string, index: number): string => `${index}:${name}`;

function resolver(palette: Palette, external?: ExternalColors) {
  const byName = new Map<string, PaletteEntry>();
  for (const e of palette.entries) if (!byName.has(e.name)) byName.set(e.name, e);

  const ctx = (visiting: ReadonlySet<string>): ColorFnContext => ({ resolve: (s) => visit(s, visiting) });

  const visit: Visit = (s, visiting) => {
    if (s == null) return null;
    if (typeof s === 'function') return visit(s(ctx(visiting)), visiting);
    if ('space' in s) return s;
    const index = s.index ?? 0;
    const key = refKey(s.ref, index);
    if (visiting.has(key)) return null;
    const next = new Set(visiting).add(key);
    const entry = byName.get(s.ref);
    if (!entry) return visit(external?.(s), next);
    if ('color' in entry) return index === 0 ? visit(entry.color, next) : null;
    return visit(nth(entry.colors(ctx(next)), index), next);
  };

  return { byName, ctx, visit };
}

/**
 * Resolve `source` to a literal. A ref names a palette entry first, then goes
 * to `external`; whatever either answers is resolved in turn. A name nothing
 * answers, an index past a sequence's end, or a chain that comes back to a ref
 * it is already resolving gives `null`.
 */
export function resolvePaletteColor(
  palette: Palette,
  source: ColorSource,
  external?: ExternalColors,
): ColorLiteral | null {
  return resolver(palette, external).visit(source, new Set());
}

/**
 * Every color under `name`, resolved lazily in order — one for a single-color
 * entry, as many as the sequence yields for a `colors` entry, nothing for a
 * name the palette lacks. Stop early to read an endless sequence.
 */
export function* resolvePaletteColors(
  palette: Palette,
  name: string,
  external?: ExternalColors,
): Generator<ColorLiteral | null> {
  const { byName, ctx, visit } = resolver(palette, external);
  const entry = byName.get(name);
  if (!entry) return;
  if ('color' in entry) {
    yield visit(entry.color, new Set([refKey(name, 0)]));
    return;
  }
  let i = 0;
  for (const item of entry.colors(ctx(new Set()))) {
    yield visit(item, new Set([refKey(name, i++)]));
  }
}

const hex2 = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');

/** `#rrggbb`, or `#rrggbbaa` below full opacity. `null` for a space the kit
 *  cannot convert, or fewer than three coordinates. */
export function colorLiteralToHex(color: ColorLiteral): string | null {
  const [x, y, z] = color.coords;
  if (z === undefined) return null;
  let rgb: readonly number[];
  switch (color.space) {
    case 'srgb':
      rgb = [x * 255, y * 255, z * 255];
      break;
    case 'oklab':
      rgb = oklabToSrgbU8(x, y, z);
      break;
    case 'oklch':
      rgb = oklabToSrgbU8(...oklchToOklab(x, y, (z * Math.PI) / 180));
      break;
    default:
      return null;
  }
  const a = color.alpha ?? 1;
  return `#${rgb.map(hex2).join('')}${a < 1 ? hex2(a * 255) : ''}`;
}

/** `#rrggbb` or `#rrggbbaa` as an `srgb` literal; `null` for anything else. */
export function hexToColorLiteral(hex: string): ColorLiteral | null {
  if (!/^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
  const byte = (i: number): number => Number.parseInt(hex.slice(i, i + 2), 16) / 255;
  const coords = [byte(1), byte(3), byte(5)];
  return hex.length === 9 ? { space: 'srgb', coords, alpha: byte(7) } : { space: 'srgb', coords };
}
