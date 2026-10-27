import { useCallback, useMemo, type RefObject } from 'react';
import { useOptionalDepRegistry } from '@weasel-js/routing/react';
import { asNodeId, type Scene } from 'core/scene/types';
import { useLatest } from '@weasel-js/react';
import { doubleClickTarget } from '../doubleClickTarget';
import { useEnteredGroup } from '../deps/enteredGroup';
import { createEnteredGroupScope } from 'domains/selection/enteredGroupScope';
import type { SelectionApi } from 'core/selection/useSelection';
import type { View } from 'core/viewport/view';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { composeAlphaFor } from '../sceneSlotWiring';
import { useSceneAdapter } from '../useSceneAdapter';
import type { SceneCanvasProps } from './props';
import { useNodeAtPoint } from './useNodeAtPoint';
import type { NodeKinds } from './useNodeKinds';
import { useSceneSelectTool, type UseSceneSelectToolArgs } from './useSceneSelectTool';
import { useOptionalViewRegistry } from '../viewRegistry';
import { useViewLayerGate } from '../useViewLayerGate';

type PickingProps<TData, TLayer extends string, TPose> = Pick<
  SceneCanvasProps<TData, TLayer, TPose>,
  'geometry' | 'alphaFor' | 'layerVisibility' | 'layerOrder' | 'isPointerInteractive' | 'enteredGroup'
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
  kinds: NodeKinds<TData>;
}) {
  const { scene, selection, descriptor, viewRef } = args;
  const { geometry, alphaFor, layerVisibility, layerOrder, isPointerInteractive } = args.props;
  const { kindOf, kindOfNode } = args.kinds;

  // The painted alpha of a node in this view: the caller's `alphaFor` times any per-node
  // override alpha. The pick path reads the same number the painter does, or a node faded
  // to nothing stays clickable.
  const composedAlphaFor = useMemo(
    () => composeAlphaFor(scene, alphaFor),
    [scene, alphaFor],
  );
  const ownEntered = useEnteredGroup(scene);
  const enteredGroup = args.props.enteredGroup ?? ownEntered;
  // A press resolves inside the entered group, so nothing outside it takes a hit, and nothing a
  // node consumes takes one until that node is entered.
  const consumerInteractive = useLatest(isPointerInteractive);
  const reachable = useMemo(() => {
    const scope = createEnteredGroupScope({ entered: enteredGroup, scene });
    return (id: string) => scope.isPointerInteractive(id) && consumerInteractive.current?.(id) !== false;
  }, [enteredGroup, scene, consumerInteractive]);

  const surfaceViewRegistry = useOptionalViewRegistry();
  const viewLayerGate = useViewLayerGate(
    layerVisibility, layerOrder, () => surfaceViewRegistry?.surface()?.layers() ?? [],
  );

  const depRegistry = useOptionalDepRegistry();
  const pasteInto = useCallback(() => depRegistry?.get('insertInto')?.get() ?? null, [depRegistry]);
  const adapter = useSceneAdapter(scene, {
    // `adapterMethods` is memoized; `selection` itself is a fresh object each render.
    selection: selection.adapterMethods,
    poseDescriptor: descriptor,
    pasteInto,
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
    isPointerInteractive: reachable,
    selectTool: args.selectTool,
  });

  const getNodeAtPoint = useNodeAtPoint({
    pickBest: selectTool.pickBest, nodes: adapter, kindOf,
  });

  const doubleClickNames = useMemo(() => kindOfNode && ((hitId: string) => doubleClickTarget(hitId, {
    parentOf: (id) => scene.get(asNodeId(id))?.parent ?? null,
    kindOf: kindOfNode,
    scope: enteredGroup.get(),
  })), [scene, kindOfNode, enteredGroup]);

  return {
    ...selectTool, adapter, kindOfNode, doubleClickNames, getNodeAtPoint, viewLayerGate, enteredGroup,
    /** What a press or a region select can reach. */
    reachable,
    /** The composed paint alpha, only when the consumer fades anything. */
    alphaOf: alphaFor ? composedAlphaFor : undefined,
  };
}
