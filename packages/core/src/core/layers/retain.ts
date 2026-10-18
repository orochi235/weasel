import type { DrawCommand } from '@weasel-js/renderer';
import type { View } from 'core/viewport/view';
import type { LayerCommandCache, RenderLayer } from './render';

/**
 * When `drawLayers` asks the renderer to keep a layer's pixels between frames
 * (`GroupDrawCommand.retain`) rather than submit its commands again.
 *
 * A layer is retained once its `deps` have held for a frame, the view has held
 * since the frame before (for a world-space layer, whose pixels move with
 * it), and it holds at least `minCommands` drawing commands. A layer changing
 * every frame is never retained: drawing it into its surface and compositing
 * that costs more than drawing it.
 */
export interface LayerRetainPolicy {
  minCommands: number;
}

/** Measured on 1280x800 at dpr 2: an unchanged layer composites cheaper than
 *  it submits from about 130 to 250 commands, depending on the layer count. */
export const DEFAULT_LAYER_RETAIN: LayerRetainPolicy = { minCommands: 250 };

const counts = new WeakMap<readonly DrawCommand[], number>();

/** Drawing commands in a tree, groups left out. Memoized by array, which a
 *  layer's cache serves unchanged while its deps hold. */
export function countDrawCommands(cmds: readonly DrawCommand[]): number {
  const known = counts.get(cmds);
  if (known !== undefined) return known;
  let n = 0;
  for (const cmd of cmds) n += cmd.kind === 'group' ? countDrawCommands(cmd.children) : 1;
  counts.set(cmds, n);
  return n;
}

function sameView(a: View | undefined, b: View): boolean {
  return a !== undefined && a.x === b.x && a.y === b.y
    && a.scale.x === b.scale.x && a.scale.y === b.scale.y;
}

/** The layer's id when the renderer should keep its pixels this frame. */
export function retainedId<TData>(
  layer: RenderLayer<TData>,
  cache: LayerCommandCache,
  view: View,
  policy: LayerRetainPolicy,
): string | undefined {
  const entry = cache.get(layer.id);
  if (!entry || !layer.deps) return undefined;
  const viewHeld = (layer.space ?? 'world') === 'screen' || sameView(entry.view, view);
  entry.view = { x: view.x, y: view.y, scale: { x: view.scale.x, y: view.scale.y } };
  if (layer.retain === false || !entry.reused || !viewHeld) return undefined;
  return layer.retain === true || countDrawCommands(entry.cmds) >= policy.minCommands
    ? layer.id
    : undefined;
}
