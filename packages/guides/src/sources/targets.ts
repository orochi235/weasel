import { nodeGates, type Bounds, type NodeId, type Scene, type SnapCollect } from '@weasel-js/core';
import { siblingIds } from '../guides/alignment/sceneBounds';

type AnyScene = Scene<unknown, string, unknown>;

/** The nodes a gesture's subject lines up with: its siblings when it has
 *  ids, the scene's visible top-level nodes for a point gesture. */
function targetIds(scene: AnyScene, exclude: readonly string[]): readonly NodeId[] {
  if (exclude.length > 0) return siblingIds(scene, exclude as readonly NodeId[]);
  const gates = nodeGates(scene);
  return scene.roots.filter((id) => !gates.hidden(id));
}

/** The target nodes' boxes, measured as the session measures its subject;
 *  none from a host that measures no boxes. */
export function targetBoxes(q: SnapCollect, scene: AnyScene): Bounds[] {
  const drawn = q.drawnBox;
  return drawn ? targetIds(scene, q.exclude).flatMap((id) => drawn(id) ?? []) : [];
}

/**
 * `derive` over the query's target boxes, kept while the scene's version and
 * the excluded ids stand still: a drag asks every frame, and nothing it
 * reads changes until it commits.
 */
export function cachedPerScene<T>(derive: (boxes: readonly Bounds[]) => T): (q: SnapCollect) => T | null {
  let key: { scene: AnyScene; version: number; exclude: string } | null = null;
  let value: T | null = null;
  return (q) => {
    const scene = q.scene;
    if (!scene) return null;
    const version = scene.getVersion();
    const exclude = q.exclude.join('\n');
    if (key === null || key.scene !== scene || key.version !== version || key.exclude !== exclude) {
      value = derive(targetBoxes(q, scene));
      key = { scene, version, exclude };
    }
    return value;
  };
}
