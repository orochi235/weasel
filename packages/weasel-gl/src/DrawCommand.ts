import type { Path, Paint, Stroke, TextStyle } from '@orochi235/weasel';
import type { Mat3 } from './mat3';

/**
 * Solid-fill paint variant (subset of the full `Paint` union from
 * `@orochi235/weasel`). Kept for back-compat with step-1/2 consumers and
 * because some code reads `fill.color` directly. Through step 4, fills can
 * be any `Paint` variant — solid, pattern, or gradient.
 */
export interface SolidPaint {
  fill?: 'solid';
  /** Hex string `#rgb` / `#rrggbb` / CSS color keyword the renderer can parse. */
  color: string;
  opacity?: number;
}

/** DrawCommand variants implemented through step 4. */
export type DrawCommand =
  | PathDrawCommand
  | GroupDrawCommand
  | TextDrawCommand
  | ImageDrawCommand;

export interface PathDrawCommand {
  kind: 'path';
  path: Path;
  /** Any `Paint` variant: solid, pattern, or gradient (linear/radial/conic). */
  fill?: Paint;
  /** Stroke spec. Only solid `paint` supported through step 4. */
  stroke?: Stroke;
  /**
   * Optional flat RGBA-per-vertex color array (length = 4 × vertexCount).
   * Lives on the DrawCommand variant, not on `Path`.
   */
  vertexColors?: number[];
}

export interface GroupDrawCommand {
  kind: 'group';
  transform?: Mat3;
  alpha?: number;
  /**
   * Optional 4×5 color matrix (row-major, 20 numbers) — `out = M₄ₓ₄ * in + bias`.
   * Accumulated multiplicatively down the group stack. Defaults to identity.
   */
  colorMatrix?: number[];
  children: DrawCommand[];
}

/**
 * Text draw command. Renders `text` at (`x`, `y`) in screen space.
 *
 * `style.fontFamily` must match a family registered via `registerFont()`.
 * If the font isn't registered yet, `drawText` logs a warning and skips.
 *
 * Step 3 scope: single-line, left-to-right, ASCII + Latin-1 only.
 * Multi-line wrapping lands in step 7 (port of createTextLayer).
 */
export interface TextDrawCommand {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  style: TextStyle;
}

/**
 * Image draw command — renders `image` at screen-space rect (x, y, w, h).
 * The image is stretched to fit; no tiling. Use a pattern Paint on a path
 * for tiling.
 */
export interface ImageDrawCommand {
  kind: 'image';
  image: ImageBitmap;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity?: number;
}
