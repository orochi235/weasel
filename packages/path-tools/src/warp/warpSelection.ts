/**
 * What a warp works on: the selection's path leaves, a selected group standing
 * for every path inside it, and its text, which converts to outlines when a
 * warp begins on it. A fresh warp is laid over the box around both.
 */
import type { ActionDeps } from '@weasel-js/routing';
import { unionRects } from '@weasel-js/geom';
import type { WarpBox } from '@weasel-js/geom/warp';
import { drawnAABBOf, type NodeId, type PathNode, pathNodesOf, shownNodeOf, type AnyScene } from '@weasel-js/core';
import { type CreateOutlinesAdapter } from '../outlines/createOutlines';
import { leavesOf } from '../shared/scenePaths';

type WarpScene = Pick<AnyScene, 'get' | 'childrenOf'>;

/** The selection's warpable leaves. */
export interface WarpLeaves {
  paths: PathNode[];
  /** Text leaves, which a warp converts before it begins; empty without an outlines adapter. */
  texts: NodeId[];
}

/** The path and text leaves under `ids`. `shapeOf` stands in a node's
 *  in-flight pose and data, as `pathNodesOf` takes it. */
export function warpLeavesOf(
  scene: WarpScene,
  ids: readonly string[],
  outlines: Pick<CreateOutlinesAdapter, 'getOutline'> | undefined,
  shapeOf?: (id: string) => { pose: unknown; data: unknown } | undefined,
): WarpLeaves {
  const leaves = leavesOf(scene, ids);
  return {
    paths: pathNodesOf(scene, leaves, shapeOf),
    texts: outlines ? leaves.filter((id) => outlines.getOutline(id) !== undefined) : [],
  };
}

/** {@link warpLeavesOf} the selection in `deps`. Reads `createOutlinesAdapter`,
 *  which an action calling it must declare. */
export function selectedWarpLeaves(deps: ActionDeps | undefined): WarpLeaves {
  const scene = deps?.scene as WarpScene | undefined;
  if (!scene) return { paths: [], texts: [] };
  return warpLeavesOf(scene, deps?.operands?.get() ?? [], deps?.createOutlinesAdapter);
}

/** The selection's path leaves alone, for an action that never meets text. */
export function selectedWarpPaths(deps: ActionDeps | undefined): PathNode[] {
  const scene = deps?.scene as WarpScene | undefined;
  return scene ? warpLeavesOf(scene, deps?.operands?.get() ?? [], undefined).paths : [];
}

/** The box around `a` and `b`, either of which may be missing. */
export function unionBox(a: WarpBox | null, b: WarpBox | null): WarpBox | null {
  return a && b ? unionRects([a, b]) : a ?? b;
}

/** The drawn box around the text nodes `texts`. */
export function textsBox(scene: WarpScene, texts: readonly NodeId[]): WarpBox | null {
  let box: WarpBox | null = null;
  for (const id of texts) {
    const node = shownNodeOf(scene, id);
    if (node) box = unionBox(box, drawnAABBOf(scene, id, node.pose));
  }
  return box;
}
