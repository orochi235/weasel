import type { DrawCommand } from '@weasel-js/renderer';
import type { View } from 'core/viewport/view';
import type { LayerCommandCache, RenderLayer } from './render';

/**
 * When `drawLayers` asks the renderer to keep a layer's pixels between frames
 * (`GroupDrawCommand.retain`) rather than submit its commands again.
 *
 * A layer is retained once its `deps` have held for a frame, the view's zoom
 * has held since the frame before (for a world-space layer, whose pixels move
 * with it; the renderer moves a kept surface with a pan where it can), and it
 * holds at least `minCommands` drawing commands, or `minCommandsWithEffects`
 * when it runs effects passes, its own or a group's inside it. A layer changing
 * every frame is never retained: drawing it into its surface and compositing
 * that costs more than drawing it.
 */
export interface LayerRetainPolicy {
  minCommands: number;
  /** Default the lesser of `minCommands` and `DEFAULT_LAYER_RETAIN`'s. */
  minCommandsWithEffects?: number;
}

/** Measured on 1280x800 at dpr 2: an unchanged layer composites cheaper than
 *  it submits from about 130 to 250 commands, depending on the layer count,
 *  and one under a blur of radius 8 from between 1 and 10
 *  (`tests/perf/recorded/retain-2026-11-03/`). */
export const DEFAULT_LAYER_RETAIN: Required<LayerRetainPolicy> = { minCommands: 250, minCommandsWithEffects: 10 };

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

const withEffects = new WeakMap<readonly DrawCommand[], boolean>();

/** Whether a tree holds a group with effects. Memoized by array. */
function holdsEffects(cmds: readonly DrawCommand[]): boolean {
  const known = withEffects.get(cmds);
  if (known !== undefined) return known;
  const found = cmds.some((cmd) => cmd.kind === 'group' && ((cmd.effects?.length ?? 0) > 0 || holdsEffects(cmd.children)));
  withEffects.set(cmds, found);
  return found;
}

/** Whether the view held since the frame before, or only panned: a renderer
 *  can move a kept surface with a pan, and decides itself when it cannot. */
function sameZoom(a: View | undefined, b: View): boolean {
  return a !== undefined && a.scale.x === b.scale.x && a.scale.y === b.scale.y;
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
  const viewHeld = (layer.space ?? 'world') === 'screen' || sameZoom(entry.view, view);
  entry.view = { x: view.x, y: view.y, scale: { x: view.scale.x, y: view.scale.y } };
  if (layer.retain === false || !entry.reused || !viewHeld) return undefined;
  if (layer.retain === true) return layer.id;
  const effects = (layer.effects?.length ?? 0) > 0 || holdsEffects(entry.cmds);
  const min = effects
    ? policy.minCommandsWithEffects ?? Math.min(policy.minCommands, DEFAULT_LAYER_RETAIN.minCommandsWithEffects)
    : policy.minCommands;
  return countDrawCommands(entry.cmds) >= min ? layer.id : undefined;
}
