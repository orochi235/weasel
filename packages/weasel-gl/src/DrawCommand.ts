import type { Path, Stroke } from '@orochi235/weasel';
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

/** DrawCommand variants implemented through step 2 (path + stroke + group). */
export type DrawCommand = PathDrawCommand | GroupDrawCommand;

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
