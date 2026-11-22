/**
 * What a tiled scene layer learns from the scene: where its content lies, for the floor, and the
 * boxes each change moved, before and after, for the tiles to mark stale. A reach tree of its own
 * reports them, boxing paint at a coarse scale so a stroke sized in screen pixels is boxed as wide
 * as it can draw at any level a tile is baked at.
 */
import type { TileBox } from '@weasel-js/tiles';
import type { View } from 'core/viewport/view';
import type { Node, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { TileDamage } from 'core/layers/tiles';
import type { PaintBoundsFn } from '../paintCull';
import { createReachTree } from './reachTree';
import { sceneReachSource } from './sceneVisibility';

type AnyNode = Node<unknown, string, unknown>;

/** The scale paint is boxed at: a `{ px }` stroke is boxed as it draws 16 times zoomed out. */
const BOX_SCALE = 1 / 16;

/** What a tiled layer of the scene reads. */
export interface SceneTileSource {
  /** The world box the layer's nodes reach, or null for none. */
  bounds(): TileBox | null;
  damage: TileDamage;
}

/** Per scene layer, the bounds and damage of a tiled scene layer, over one reach tree for the scene. */
export function createSceneTileSources<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  paintBounds: PaintBoundsFn<Node<TData, TLayer, TPose>, TPose>,
  toPose?: (node: Node<TData, TLayer, TPose>) => TPose,
): (layer: string) => SceneTileSource {
  const view: View = { x: 0, y: 0, scale: { x: BOX_SCALE, y: BOX_SCALE } };
  const octaves = new Map<string, View>(scene.layers.map((l) => [l.id, view]));
  const queues = new Map<string, (Float64Array | 'all')[]>();
  const source = sceneReachSource(scene as never, paintBounds as PaintBoundsFn<AnyNode, unknown>, toPose as never, octaves, () => 0);
  const tree = createReachTree(source, undefined, (box, id) => {
    const layer = id === undefined ? undefined : scene.get(asNodeId(id))?.layer;
    for (const [l, q] of queues) if (layer === undefined || l === layer) q.push(box);
  });
  return (layer) => {
    const queue: (Float64Array | 'all')[] = [];
    queues.set(layer, queue);
    return {
      // The whole scene's reach, which holds every layer's: the floor errs wide rather than short.
      bounds: () => {
        tree.ensure();
        const r = tree.reachOf(null);
        return r === 'all' ? null : r;
      },
      damage: {
        since: () => {
          tree.ensure();
          const boxes = queue.splice(0);
          return boxes.some((b) => b === 'all') ? 'all' : (boxes as Float64Array[]);
        },
      },
    };
  };
}
