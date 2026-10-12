/**
 * Uniform-grid sprite sheet layout — frame index to the source rect an
 * `ImageDrawCommand` samples. Pure arithmetic over the grid description; it
 * never touches the bitmap.
 */

/** A sprite sheet's grid. `margin` and `spacing` follow the Tiled / Aseprite
 *  tileset convention, so a sheet exported from either describes itself here. */
export interface SpriteSheet {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  /** Empty pixels around the whole grid. Default 0. */
  margin?: number;
  /** Empty pixels between adjacent cells — the gutter that keeps linear
   *  sampling off the neighboring frame. Default 0. */
  spacing?: number;
}

/**
 * Row-major source rect for frame `index`, counting from 0 at the top-left.
 *
 * `index` is not range-checked and does not wrap: past the last cell this
 * returns a rect below the sheet, which draws as an edge smear. Wrapping is
 * the animation's business (`frameRect(sheet, tick % count)`) — a sheet does
 * not know how many of its cells are filled.
 */
export function frameRect(
  sheet: SpriteSheet,
  index: number,
): { x: number; y: number; w: number; h: number } {
  const { frameWidth, frameHeight, columns } = sheet;
  const margin = sheet.margin ?? 0;
  const spacing = sheet.spacing ?? 0;
  const col = index % columns;
  const row = Math.floor(index / columns);
  return {
    x: margin + col * (frameWidth + spacing),
    y: margin + row * (frameHeight + spacing),
    w: frameWidth,
    h: frameHeight,
  };
}
