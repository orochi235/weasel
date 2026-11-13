import { unionAABB } from 'core/geometry/unionBounds';
import { worldPoseLookup } from 'core/scene/composePose';
import { documentOf } from 'core/scene/documentOf';
import { withoutPageStructure } from 'core/scene/nodeGates';
import { scenePoseAdapter } from 'core/scene/scenePoseAdapter';
import type { NodeId } from 'core/scene/types';
import { drawnBoundsScene } from '../derivedPath';
import { drawnAABBOf } from '../drawnBounds';
import type { ExportRegion, ExportScene } from './exportTypes';

/**
 * The world box `ids` cover as the document draws them, strokes included:
 * the region that exports a selection. Pages and the page run are left out of
 * `ids`. `null` when none of them draws anything.
 */
export function selectionRegion(scene: ExportScene, ids: readonly string[], name?: string): ExportRegion | null {
  const doc = documentOf(scene);
  const world = worldPoseLookup(scenePoseAdapter(doc), doc.composition.compose as (p: unknown, c: unknown) => unknown);
  const drawn = drawnBoundsScene(doc);
  const boxes = withoutPageStructure(doc, ids).map((id) => {
    const pose = world(id);
    return pose === null || doc.get(id as NodeId) === undefined
      ? null : drawnAABBOf(drawn, id as NodeId, pose, { worldPoseOf: (m) => world(m) });
  });
  const box = unionAABB(boxes);
  return box === null ? null : { x: box.x, y: box.y, width: box.width, height: box.height, ...(name !== undefined ? { name } : {}) };
}
