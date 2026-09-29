/**
 * Synthetic-oblique angle, in radians — 12°, the conventional CSS
 * `font-style: oblique`. Shared by everything that fakes an italic: the SDF
 * tier skews quads by it, the outline tier shears glyph geometry by it, and
 * `textToPath` bakes the same shear into extracted outlines. One constant so a
 * face that falls back to the upright atlas leans the same amount however it
 * ends up being drawn.
 */
export const SYNTHETIC_ITALIC_RADIANS = 0.2094;
