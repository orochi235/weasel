import type { Path, Stroke, TextStyle } from '@orochi235/weasel';
import type { Mat3 } from './mat3';

/**
 * Solid-fill paint variant (subset of the spec's full Paint union).
 * Step 1 supports only solid; pattern + gradients arrive in step 4.
 */
export interface SolidPaint {
  fill?: 'solid';
  /** Hex string `#rgb` / `#rrggbb` / CSS color keyword the renderer can parse. */
  color: string;
  opacity?: number;
}

/** DrawCommand variants implemented through step 3 (path + stroke + group + text). */
export type DrawCommand = PathDrawCommand | GroupDrawCommand | TextDrawCommand;

export interface PathDrawCommand {
  kind: 'path';
  path: Path;
  fill?: SolidPaint;
  /** Stroke spec. In step 2 only solid `paint` is supported; gradients/patterns arrive in step 4. */
  stroke?: Stroke;
}

export interface GroupDrawCommand {
  kind: 'group';
  transform?: Mat3;
  alpha?: number;
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
