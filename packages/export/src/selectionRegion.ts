import {
  annotationLayerIds, documentOf, drawnAabbOf, drawnBoundsScene, nodeGates, scenePoseAdapter, unionAabb,
  withoutPageStructure, worldPoseLookup, type NodeId,
} from '@weasel-js/core';
import type { ExportRegion, ExportScene } from './exportTypes';

/**
 * The world box `ids` cover as the document draws them, strokes included:
 * the region that exports a selection. Pages and the page run are left out of
 * `ids`, and so is what no export draws: a hidden node, and a node on a
 * hidden or annotation layer (what its children draw still counts). `null`
 * when none of them draws anything.
 */
export function selectionRegion(scene: ExportScene, ids: readonly string[], name?: string): ExportRegion | null {
  const doc = documentOf(scene);
  const world = worldPoseLookup(scenePoseAdapter(doc), doc.composition.compose as (p: unknown, c: unknown) => unknown);
  const drawn = drawnBoundsScene(doc);
  const boxOf = (id: NodeId) => {
    const pose = world(id);
    return pose === null ? null : drawnAabbOf(drawn, id, pose, { worldPoseOf: (m) => world(m) });
  };
  const box = unionAabb(shownIds(doc, withoutPageStructure(doc, ids)).map(boxOf));
  return box === null ? null : { x: box.x, y: box.y, width: box.width, height: box.height, ...(name !== undefined ? { name } : {}) };
}

/** `ids` as an export draws them: a hidden node and its subtree dropped, and a node on a hidden or
 *  annotation layer replaced by its children, as the render walk paints them. */
function shownIds(doc: ExportScene, ids: readonly string[]): NodeId[] {
  const flags = nodeGates({ get: (id) => doc.get(id) });
  const gates = nodeGates(doc);
  const annotations = annotationLayerIds(doc.layers);
  const shown = (id: NodeId): NodeId[] => {
    const node = doc.get(id);
    if (node === undefined || flags.hidden(node)) return [];
    return gates.hidden(node) || annotations.has(node.layer) ? doc.childrenOf(id).flatMap(shown) : [id];
  };
  return ids.flatMap((id) => shown(id as NodeId));
}
