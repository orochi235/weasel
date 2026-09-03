/**
 * A cursor glyph: SVG path `d` strings tagged with a paint role, plus the
 * hotspot in glyph units. The same record feeds both the data-URI baker and
 * the Path2D painter, so `d` is the one geometry form neither has to translate.
 */
export interface CursorGlyph {
  /** Side of the square viewBox the paths are authored in. */
  readonly box: number;
  /** Hotspot in glyph units, scaled to integer CSS px at bake time. */
  readonly hotspot: readonly [number, number];
  readonly paths: readonly CursorPath[];
}

export type CursorPath =
  /** The silhouette. Filled in ink, stroked in halo behind the fill. */
  | { readonly role: 'ink'; readonly d: string }
  /** A division inside the silhouette, drawn in the halo color. */
  | { readonly role: 'detail'; readonly d: string; readonly width: number }
  /** A literal color, for glyphs that carry a swatch. */
  | { readonly role: 'accent'; readonly d: string; readonly fill: string };

/**
 * Ink and halo are constants of the register rather than parameters: a
 * self-contrasting glyph reads on white paper, dark chrome and mid-tone
 * artwork alike precisely because it does not track the theme.
 */
export const CURSOR_INK = '#141418';
export const CURSOR_HALO = '#ffffff';
export const CURSOR_HALO_WIDTH = 2.6;

/**
 * Chrome silently drops a cursor image above this size and falls back to the
 * keyword after the comma, with no error anywhere. Measured on Chrome 152 /
 * macOS 26.5; see the spec's "Measured browser behavior".
 */
export const CURSOR_MAX_CSS_PX = 128;

/** Every coordinate pair in a `d` string. Enough for the extent check; these
 *  are authored paths in a known dialect, not arbitrary user input. */
function coords(d: string): number[] {
  return (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

/**
 * True when every authored coordinate sits at least half a halo stroke inside
 * the viewBox. A clipped halo is invisible at proof size and flattens the
 * glyph's outline at cursor size, so it is worth failing loudly at authoring
 * time rather than discovering it on a dark background.
 */
export function haloFitsInBox(glyph: CursorGlyph): boolean {
  const margin = CURSOR_HALO_WIDTH / 2;
  return glyph.paths.every((p) =>
    coords(p.d).every((v) => v >= margin && v <= glyph.box - margin),
  );
}
