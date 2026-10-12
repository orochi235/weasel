import {
  boundsOfPath,
  type CreateOutlinesAdapter,
  defaultCommitAdapter,
  UNION_OF_CHILDREN,
  unionOfChildren,
  useBooleansAdapter,
  useCreateOutlinesAdapter,
  useSelection
} from '@weasel-js/core';
import {
  useMemo, useRef
} from 'react';
import { drawBooleansAdapter, type DrawScene, pathPaintAt, textSourceOf, worldPathOf } from './booleansAdapter';

// ─── Helpers ────────────────────────────────────────────────────────────────
// ─── Outer App: install the color context so swatches + actions resolve ─────

/** Publishes a `BooleansAdapter` as a dep so the kit's Pathfinder
 *  descriptors can read selection and execute boolean ops on WeaselDraw nodes.
 *  Must live inside `<SceneCanvas>` since `useBooleansAdapter` calls
 *  `useDepSource`, which requires the surrounding `<DepRegistryProvider>`. */
export function BooleansAdapterPublisher({
  scene,
  selection,
}: {
  scene: DrawScene;
  selection: ReturnType<typeof useSelection>;
}): null {
  const adapter = useMemo(
    () => drawBooleansAdapter(scene, selection.adapterMethods),
    [scene, selection],
  );
  useBooleansAdapter(adapter);
  return null;
}

/** Publishes the adapter the kit's `createOutlines` and `outlineStroke`
 *  actions convert text and strokes through. A source that becomes several
 *  paths becomes a group of them. */
export function CreateOutlinesAdapterPublisher({
  scene,
  selection,
}: {
  scene: DrawScene;
  selection: ReturnType<typeof useSelection>;
}): null {
  const idCounterRef = useRef(0);
  const adapter = useMemo<CreateOutlinesAdapter>(() => {
    const a: CreateOutlinesAdapter = {
      ...defaultCommitAdapter(scene, selection.adapterMethods),
      getTextSource: (id) => textSourceOf(scene, id),
      getWorldPath: (id) => worldPathOf(scene, id),
      getPaint: (id) => pathPaintAt(scene, id),
      createPathNode: (path, sourceId, { fill, stroke, parent }) => {
        const b = boundsOfPath(path);
        return {
          id: `o-${Date.now().toString(36)}-${idCounterRef.current++}`,
          kind: 'leaf',
          layer: scene.get(sourceId)?.layer ?? 'default',
          parent,
          pose: { x: b.x, y: b.y, width: b.width, height: b.height },
          data: { path, fill, ...(stroke !== undefined ? { stroke } : {}) },
        } as { id: string };
      },
      // The kit `group` action's container: an envelope tracking its members.
      createContainerNode: (sourceId, { parent, bounds }) => ({
        id: `o-${Date.now().toString(36)}-${idCounterRef.current++}`,
        kind: 'container',
        layer: scene.get(sourceId)?.layer ?? 'default',
        parent,
        pose: bounds,
        data: {},
        dependsOn: 'children',
        derivePose: scene.registry.derivePose?.[UNION_OF_CHILDREN] ?? unionOfChildren,
      }) as { id: string },
      applyOps: (ops, label) => {
        scene.applyBatch(ops, label ?? 'Outline', a);
      },
    };
    return a;
  }, [scene, selection]);
  useCreateOutlinesAdapter(adapter);
  return null;
}
