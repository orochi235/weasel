import { defaultCommitAdapter, pathNode, type SelectionApi, UNION_OF_CHILDREN, unionOfChildren } from '@weasel-js/core';
import { type CreateOutlinesAdapter } from '@weasel-js/path-tools';
import { inFrameOf, outlineAt, pathPaintAt, worldPathOf } from './booleansAdapter';
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
    getOutline: (id) => outlineAt(scene, id),
    getWorldPath: (id) => worldPathOf(scene, id),
    getPaint: (id) => pathPaintAt(scene, id),
    createPathNode: (path, sourceId, { fill, stroke, parent }) => {
      const source = scene.get(sourceId);
      // A path under the source's own parent stands in for the source; one
      // under a minted group is a part of it, and the group carries the data.
      const home = source?.parent ?? null;
      const standsIn = parent === home;
      // A minted group is an envelope, which gives its members no frame of its
      // own: they are stored in the frame the source was.
      return inFrameOf(scene, home, pathNode(
        scene.mintId(), path,
        { ...(standsIn ? carriedData(source?.data) : {}), fill, ...(stroke !== undefined ? { stroke } : {}) },
        { layer: source?.layer ?? 'default', parent },
      ));
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
