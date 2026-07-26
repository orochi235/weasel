/** Kit-shipped default paint constants.
 *
 *  Single source of truth for the colors the built-in tools and the default
 *  fill/stroke actions reach for. Consumers that want to match the kit's
 *  out-of-the-box look (e.g. seed their own active-paint state) should import
 *  these rather than re-declaring the literals.
 *
 *  All values are `#rrggbbaa` so they round-trip through the kit's hex8 alpha
 *  helpers (`util/color`) without ambiguity.
 */

/** Default fill paint for shapes and the fill action — opaque white. */
export const DEFAULT_FILL_COLOR = '#ffffffff';

/** Default stroke paint for shapes and the stroke action — opaque black. */
export const DEFAULT_STROKE_COLOR = '#000000ff';

/** Default fill palette cycled through for auto-generated shape nodes
 *  (the kit's built-in shape tools and the `insert` action). */
export const DEFAULT_PALETTE: readonly string[] = [
  '#7fb069',
  '#d4a574',
  '#a48bd4',
  '#7ab8d4',
  '#d47a7a',
];

/** Preview / "ghost" stroke color used by drag-to-draw tool overlays and the
 *  selected-anchor highlight. Derived from the first palette entry so the
 *  preview chrome matches the default insert color. */
export const GHOST_STROKE: string = DEFAULT_PALETTE[0];
