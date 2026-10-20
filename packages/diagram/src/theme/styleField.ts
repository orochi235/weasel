/** A color on a shape or connector that the author can set by hand, and a theme then leaves alone.
 *  On a connector, `text` is its label's color. */
export type StyleField = 'fill' | 'stroke' | 'text';

/** A part of a shape's or connector's text face the author can set by hand, which a theme then
 *  leaves alone. Kept apart from {@link StyleField}, so choosing a role, which hands back the
 *  colors, keeps it. */
export type FontField = 'size';
