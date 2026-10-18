import { useMemo, type RefObject } from 'react';
import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { View } from 'core/viewport/view';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { composeAlphaFor } from '../sceneSlotWiring';
import { useSceneAdapter } from '../useSceneAdapter';
import type { SceneCanvasProps } from './props';
import { useNodeAtPoint } from './useNodeAtPoint';
import { useNodeKinds } from './useNodeKinds';
import { useSceneSelectTool, type UseSceneSelectToolArgs } from './useSceneSelectTool';
import { useViewLayerGate } from './useViewLayerGate';

type PickingProps<TData, TLayer extends string, TPose> = Pick<
  SceneCanvasProps<TData, TLayer, TPose>,
  'geometry' | 'routing' | 'alphaFor' | 'layerVisibility' | 'layerOrder' | 'isPointerInteractive'
>;

/**
 * The canvas's adapter and everything that answers "what is under this point": the select
 * tool's pickers and bounds, the node kinds, and the paint gates picking shares with the painter.
 */
export function useScenePicking<TData, TLayer extends string, TPose>(args: {
  scene: Scene<TData, TLayer, TPose>;
  selection: SelectionApi;
  descriptor: PoseDescriptor<TPose>;
  props: PickingProps<TData, TLayer, TPose>;
  viewRef: RefObject<View>;
  selectTool: UseSceneSelectToolArgs<TData, TLayer, TPose>['selectTool'];
}) {
  const { scene, selection, descriptor, viewRef } = args;
  const { geometry, routing, alphaFor, layerVisibility, layerOrder, isPointerInteractive } = args.props;
  const { kindOfData, kindOfNode } = useNodeKinds(scene, routing);

  // The painted alpha of a node in this view: the caller's `alphaFor` times any per-node
  // override alpha. The pick path reads the same number the painter does, or a node faded
  // to nothing stays clickable.
  const composedAlphaFor = useMemo(
    () => composeAlphaFor(scene, alphaFor),
    [scene, alphaFor],
  );
  const viewLayerGate = useViewLayerGate(layerVisibility, layerOrder);

  const adapter = useSceneAdapter(scene, {
    // `adapterMethods` is memoized; `selection` itself is a fresh object each render.
    selection: selection.adapterMethods,
    poseDescriptor: descriptor,
  });

  const selectTool = useSceneSelectTool({
    scene,
    adapter,
    poseDescriptor: descriptor,
    geometry,
    // The pick tolerance is declared in screen pixels; this is what converts it.
    getView: () => viewRef.current,
    // Only when the consumer actually fades something. Without a prop the
    // composed function is just the override lookup, and the source resolves
    // that once per walk instead of once per candidate.
    ...(alphaFor ? { alphaOf: composedAlphaFor } : {}),
    ...(viewLayerGate ? { layerIsPainted: viewLayerGate } : {}),
    selectTool: args.selectTool,
  });

  const getNodeAtPoint = useNodeAtPoint({
    pickBest: selectTool.pickBest, nodes: adapter, kindOfData, isPointerInteractive,
  });

  return {
    ...selectTool, adapter, kindOfNode, getNodeAtPoint, viewLayerGate,
    /** The composed paint alpha, only when the consumer fades anything. */
    alphaOf: alphaFor ? composedAlphaFor : undefined,
  };
}
