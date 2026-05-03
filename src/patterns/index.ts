/**
 * Tile-pattern primitive — a small helper for building repeating
 * `CanvasPattern` instances from a draw callback. The result plugs into a
 * `Paint` of `{ fill: 'pattern', pattern }` (see `./paint.ts`).
 *
 * For the rendering side (region fills, stroke strategies, paint dispatch),
 * see `./paint.ts`. For ready-to-use named patterns (hatch, crosshatch,
 * dots, scatter), see the `@orochi235/weasel/patterns-builtin` subpath.
 */

/** Options for `createTilePattern`. */
export interface TilePatternOpts {
  /** Edge length (in pixels) of the square offscreen tile. */
  size: number;
  /** Paint one tile at integer-pixel coordinates `(0, 0) .. (size, size)`. */
  draw: (oc: CanvasRenderingContext2D, size: number) => void;
}

/**
 * Render a single tile to an offscreen canvas and return a repeating
 * `CanvasPattern`. Returns `null` when the offscreen 2D context can't be
 * acquired (e.g. some headless environments).
 */
export function createTilePattern(
  ctx: CanvasRenderingContext2D,
  opts: TilePatternOpts,
): CanvasPattern | null {
  const off = document.createElement('canvas');
  off.width = opts.size;
  off.height = opts.size;
  const oc = off.getContext('2d');
  if (!oc) return null;
  opts.draw(oc, opts.size);
  return ctx.createPattern(off, 'repeat');
}
