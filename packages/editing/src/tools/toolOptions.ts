import type { LassoHitMode } from '@weasel-js/core';
import type { InsertToolOptions } from './shared/insertToolOptions';

declare module '@weasel-js/core' {
  /** The options editing's offered tools take from `<SceneCanvas toolOptions>`. */
  interface SceneCanvasToolOptions {
    /** The lasso's hit mode, its `mode` option's default. */
    lasso?: { mode?: LassoHitMode };
    /** Every drag-to-insert tool's: rect, ellipse, line, polygon, star. */
    insert?: InsertToolOptions;
  }
}
