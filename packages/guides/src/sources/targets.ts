import { nodeGates, type Bounds, type NodeId, type Scene, type SceneNode, type SnapCollect } from '@weasel-js/core';
import { siblingIds } from '../guides/alignment/sceneBounds';

type AnyScene = Scene<unknown, string, unknown>;

function visibleRoots(scene: AnyScene): readonly NodeId[] {
  const gates = nodeGates(scene);
  return scene.roots.filter((id) => !gates.hidden(id));
}

/** Which nodes may be targets; one that fails offers no lines or gaps. */
export type TargetFilter = (node: SceneNode<unknown, string, unknown>) => boolean;

/** The nodes a gesture's subject lines up with: its siblings when it has
 *  ids, the scene's visible top-level nodes for a point gesture. */
function targetIds(scene: AnyScene, exclude: readonly string[], filter?: TargetFilter): readonly NodeId[] {
  const ids = exclude.length > 0
    ? siblingIds(scene, exclude as readonly NodeId[])
    : visibleRoots(scene);
  if (!filter) return ids;
  return ids.filter((id) => {
    const node = scene.get(id);
    return node !== undefined && filter(node);
  });
}

/** The target nodes' boxes, measured as the session measures its subject;
 *  none from a host that measures no boxes. */
export function targetBoxes(q: SnapCollect, scene: AnyScene, filter?: TargetFilter): Bounds[] {
  const drawn = q.drawnBox;
  return drawn ? targetIds(scene, q.exclude, filter).flatMap((id) => drawn(id) ?? []) : [];
}

/**
 * `derive` over the query's target boxes, kept while the scene's version and
 * the excluded ids stand still: a drag asks every frame, and nothing it
 * reads changes until it commits.
 */
export function cachedPerScene<T>(
  derive: (boxes: readonly Bounds[]) => T, filter?: TargetFilter,
): (q: SnapCollect) => T | null {
  let key: { scene: AnyScene; version: number; exclude: string } | null = null;
  let value: T | null = null;
  return (q) => {
    const scene = q.scene;
    if (!scene) return null;
    const version = scene.getVersion();
    const exclude = q.exclude.join('\n');
    if (key === null || key.scene !== scene || key.version !== version || key.exclude !== exclude) {
      value = derive(targetBoxes(q, scene, filter));
      key = { scene, version, exclude };
    }
    return value;
  };
}
