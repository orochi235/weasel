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
  /**
   * The glyph-unit radius a `worldRadius` spec means, for glyphs that measure
   * something — a brush ring reads as a lie about the brush size unless the
   * painter knows which circle in the drawing is the one being sized. Defaults
   * to the box's inscribed radius.
   */
  readonly radius?: number;
  readonly paths: readonly CursorPath[];
}

export type CursorPath =
  /** A filled part of the silhouette. */
  | { readonly role: 'ink'; readonly d: string }
  /** An unfilled part of the silhouette — a handle, a wire, an arc. */
  | { readonly role: 'stroke'; readonly d: string; readonly width: number }
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
 * Rotation steps a baked angle is quantized to. Below 16 the cursor visibly
 * snaps against a smoothly rotating selection; above it the cache grows for no
 * perceptible gain.
 */
export const CURSOR_ANGLE_STEPS = 16;

/**
 * Chrome silently drops a cursor image above this size and falls back to the
 * keyword after the comma, with no error anywhere. Measured on Chrome 152 /
 * macOS 26.5; see the spec's "Measured browser behavior".
 */
export const CURSOR_MAX_CSS_PX = 128;

/**
 * Visits the points that bound an authored `d` string, for the fit guards below.
 *
 * Command-aware on purpose. Scraping every number out of the string instead
 * reads an arc's radii and its three flags as coordinates, which reports a
 * bogus `0` for every `A` ever written.
 *
 * An arc is bounded by the circle it lies on: its centre is recovered from the
 * endpoints and radius, then the whole circle is admitted. Expanding the arc's
 * *endpoint* by the radii instead over-reports whenever an endpoint sits at an
 * extreme of the circle, which is exactly where the half-circle idiom these
 * glyphs use puts it.
 *
 * The authored dialect is absolute `M`/`L`/`A`/`Z` with circular arcs. A
 * relative command would be measured as if absolute and silently under-report,
 * so it throws.
 */
function walk(d: string, see: (x: number, y: number) => void): void {
  let cx = 0;
  let cy = 0;
  for (const [, cmd, args] of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    if (cmd !== cmd.toUpperCase()) {
      throw new Error(`cursor glyph path uses a relative command '${cmd}': ${d}`);
    }
    const nums = (args.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (cmd === 'Z') continue;
    if (cmd === 'A') {
      for (let i = 0; i + 7 <= nums.length; i += 7) {
        const [rx, ry, , largeArc, sweep, x, y] = nums.slice(i, i + 7);
        const r = Math.max(rx, ry);
        const dx = x - cx;
        const dy = y - cy;
        const half = Math.hypot(dx, dy) / 2;
        // Centre sits off the chord midpoint by this much, perpendicular to it.
        const off = Math.sqrt(Math.max(0, r * r - half * half));
        const sign = largeArc === sweep ? -1 : 1;
        const ux = half > 0 ? -dy / (half * 2) : 0;
        const uy = half > 0 ? dx / (half * 2) : 0;
        const ox = (cx + x) / 2 + sign * off * ux;
        const oy = (cy + y) / 2 + sign * off * uy;
        see(ox - r, oy - r);
        see(ox + r, oy - r);
        see(ox - r, oy + r);
        see(ox + r, oy + r);
        cx = x;
        cy = y;
      }
      continue;
    }
    // M and L: plain coordinate pairs.
    for (let i = 0; i + 2 <= nums.length; i += 2) {
      cx = nums[i];
      cy = nums[i + 1];
      see(cx, cy);
    }
  }
}

/**
 * True when every authored path sits at least half a halo stroke inside the
 * viewBox. A clipped halo is invisible at proof size and flattens the glyph's
 * outline at cursor size, so it is worth failing loudly at authoring time
 * rather than discovering it on a dark background.
 */
export function haloFitsInBox(glyph: CursorGlyph): boolean {
  const margin = CURSOR_HALO_WIDTH / 2;
  let ok = true;
  for (const p of glyph.paths) {
    walk(p.d, (x, y) => {
      for (const v of [x, y]) {
        if (v < margin || v > glyph.box - margin) ok = false;
      }
    });
  }
  return ok;
}

/**
 * True when the glyph still fits its viewBox at every rotation — i.e. every
 * authored point is inside the box's inscribed circle, halo included.
 *
 * Bake rotates about the box centre in a viewBox that does not grow, so a
 * glyph that merely satisfies {@link haloFitsInBox} can have its corners
 * sheared off partway round. The loss is a few pixels at cursor size and
 * invisible until someone looks at exactly the wrong angle, which is why it
 * is worth failing at authoring time.
 */
export function rotationFitsInBox(glyph: CursorGlyph): boolean {
  const c = glyph.box / 2;
  const limit = c - CURSOR_HALO_WIDTH / 2;
  let ok = true;
  for (const p of glyph.paths) {
    walk(p.d, (x, y) => {
      if (Math.hypot(x - c, y - c) > limit) ok = false;
    });
  }
  return ok;
}
