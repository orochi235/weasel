import { commandPaint, type DrawCommand } from '@weasel-js/renderer';
import type { Paint } from '@weasel-js/paint';
import type { Dims, RenderLayer } from './render';

/** The id of the layer {@link createBackgroundFillLayer} builds. */
export const BACKGROUND_FILL_LAYER_ID = 'scene-background-fill';

/**
 * `paint` filling a `size` rect at the origin, with `'bounds'` units resolved
 * against that rect. Empty when the paint cannot be drawn yet.
 */
export function backgroundFillCommands(paint: Paint, size: Dims): DrawCommand[] {
  const rect = { x: 0, y: 0, width: size.width, height: size.height };
  const fill = commandPaint(paint, rect);
  return fill ? [{ kind: 'path', path: { kind: 'rect', ...rect }, fill: { paint: fill } }] : [];
}

/** A screen-space layer filling the whole surface, whatever the camera. */
export function createBackgroundFillLayer(paint: Paint): RenderLayer<unknown> {
  return {
    id: BACKGROUND_FILL_LAYER_ID,
    label: 'Background fill',
    space: 'screen',
    draw: (_data, _view, dims) => backgroundFillCommands(paint, dims),
  };
}
