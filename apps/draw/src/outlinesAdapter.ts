import {
  boundsOfPath,
  type CreateOutlinesAdapter,
  defaultCommitAdapter,
  type SelectionApi,
  UNION_OF_CHILDREN,
  unionOfChildren,
} from '@weasel-js/core';
import { pathPaintAt, textSourceOf, worldPathOf } from './booleansAdapter';
import { carriedData, type DrawScene } from './drawDocument';

/** The adapter the kit's `createOutlines` and `outlineStroke` actions convert
 *  text and strokes through. A source that becomes several paths becomes a
 *  group of them. */
export function drawOutlinesAdapter(
  scene: DrawScene,
  selection: SelectionApi['adapterMethods'],
): CreateOutlinesAdapter {
  const a: CreateOutlinesAdapter = {
    ...defaultCommitAdapter(scene, selection),
    getTextSource: (id) => textSourceOf(scene, id),
    getWorldPath: (id) => worldPathOf(scene, id),
    getPaint: (id) => pathPaintAt(scene, id),
    createPathNode: (path, sourceId, { fill, stroke, parent }) => {
      const b = boundsOfPath(path);
      const source = scene.get(sourceId);
      // A path under the source's own parent stands in for the source; one
      // under a minted group is a part of it, and the group carries the data.
      const standsIn = parent === (source?.parent ?? null);
      return {
        id: scene.mintId(),
        kind: 'mark',
        layer: source?.layer ?? 'default',
        parent,
        pose: { x: b.x, y: b.y, width: b.width, height: b.height },
        data: { ...(standsIn ? carriedData(source?.data) : {}), path, fill, ...(stroke !== undefined ? { stroke } : {}) },
      } as { id: string };
    },
    // The kit `group` action's container: an envelope tracking its members.
    createContainerNode: (sourceId, { parent, bounds }) => ({
      id: scene.mintId(),
      kind: 'group',
      layer: scene.get(sourceId)?.layer ?? 'default',
      parent,
      pose: bounds,
      data: carriedData(scene.get(sourceId)?.data),
      dependsOn: 'children',
      derivePose: scene.registry.derivePose?.[UNION_OF_CHILDREN] ?? unionOfChildren,
    }) as { id: string },
    applyOps: (ops, label) => {
      scene.applyBatch(ops, label ?? 'Outline', a);
    },
  };
  return a;
}
