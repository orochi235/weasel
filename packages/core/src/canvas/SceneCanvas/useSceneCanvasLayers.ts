import { useMemo, useRef, type MutableRefObject } from 'react';
import type { ColorOverrideRegistry } from '@weasel-js/animator';
import type { Dispatcher } from '@weasel-js/routing';
import type { Affordance } from 'affordances/types';
import type { Node, NodeId, Scene } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { PlaneMap } from 'core/viewport/parallax';
import type { View } from 'core/viewport/view';
import type { PathEditState } from 'features/paths/pathEditState';
import { usePathEditOverlayLayer } from 'features/paths/usePathEdit';
import type { rotationBadgeOf } from 'features/selection/overlay';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { HierarchicalAdapter } from '../buildSceneTree';
import { builtLayersOf, type CanvasLayers } from '../layerSlots';
import { createSlopsDebugLayer } from '../slopsDebugLayer';
import { mergeLayersWithDefaults, type SceneCanvasLayers } from './props';
import { useDispatcherOverlayLayer } from './useDispatcherOverlayLayer';
import { usePreviewGhostLayer } from './usePreviewGhostLayer';
import { useSceneSlotLayers } from './useSceneSlotLayers';
import { useSelectionOverlayLayer } from './useSelectionOverlayLayer';

/**
 * The layer map `<SceneCanvas>` hands `<Canvas>`: the caller's `layers` over
 * the kit defaults, with the scene and selection-overlay slots built, and the
 * canvas's own layers anchored around them. The preview ghost sits above the
 * scene, the dispatcher's overlay (marquee, lasso) above the ghost, and the
 * anchor overlay above the selection chrome.
 */
export function useSceneCanvasLayers<TData, TLayer extends string, TPose>(args: {
  /** `<SceneCanvas layers>`. Omitted, the result is the full default set. */
  layers: SceneCanvasLayers<Node<TData, TLayer, TPose>, TPose> | undefined;
  /** The device profile's, which sizes the default handles. */
  targetScale: number;
  scene: Scene<TData, TLayer, TPose>;
  adapter: HierarchicalAdapter<Node<TData, TLayer, TPose>, TPose>;
  poseDescriptor: PoseDescriptor<TPose>;
  alphaFor: ((id: string) => number) | undefined;
  colorOverrides: ColorOverrideRegistry | undefined;
  boundsOf: (id: string) => Bounds | null;
  planeOfNode: (id: string, view: View) => PlaneMap | null;
  /** Ids an in-flight gesture is ghosting. */
  previewIds: () => Iterable<string> | null;
  dispatcher: Dispatcher;
  pathEditState: PathEditState;
  /** `debug.slops`: paint the hit regions of the chrome affordances. */
  slops: boolean;
}): {
  layers: CanvasLayers;
  /** Where the selection overlay paints its rotate badge, or null. */
  rotationBadge: ReturnType<typeof rotationBadgeOf>;
  /** The affordances the gesture mounter hit-tests, which it publishes here
   *  so the slops halos are the hit regions rather than a copy of them. */
  chromeAffordancesRef: MutableRefObject<readonly Affordance[]>;
} {
  const { scene, adapter, poseDescriptor, alphaFor, dispatcher, pathEditState, slops, targetScale } = args;

  const merged = useMemo(
    () => mergeLayersWithDefaults(args.layers, targetScale),
    [args.layers, targetScale],
  );

  const { config: sceneSlot, layers: sceneLayers } = useSceneSlotLayers({
    slot: merged.scene,
    scene,
    adapter,
    alphaFor,
    colorOverrides: args.colorOverrides,
    boundsOf: args.boundsOf,
    previewIds: args.previewIds,
  });
  // Takes the scene-wired slot, so a ghosted derived node still resolves its path.
  const previewLayer = usePreviewGhostLayer<TData, TLayer, TPose>({ scene, sceneSlot, dispatcher });
  const dispatcherOverlay = useDispatcherOverlayLayer({ dispatcher });

  const chromeAffordancesRef = useRef<readonly Affordance[]>([]);
  const slopsLayer = useMemo(
    () => createSlopsDebugLayer({ getAffordances: () => chromeAffordancesRef.current }),
    [],
  );

  const pathEditingOverlayLayer = usePathEditOverlayLayer(pathEditState, {
    nodeOf: (id) => scene.get(id as NodeId),
    planeOfNode: args.planeOfNode,
  });

  const { layer: selectionOverlayLayer, rotationBadge } = useSelectionOverlayLayer<TPose>(
    merged.selectionOverlay,
    pathEditState.getEditingIds,
    poseDescriptor,
  );

  const layers = useMemo<CanvasLayers>(() => ({
    ...builtLayersOf(merged),
    scene: sceneLayers,
    selectionOverlay: selectionOverlayLayer ? { layer: selectionOverlayLayer } : null,
    previewGhost: { layer: previewLayer, after: 'scene' },
    dispatcherOverlay: { layer: dispatcherOverlay, after: 'previewGhost' },
    pathEditingOverlay: { layer: pathEditingOverlayLayer, after: 'selectionOverlay' },
    ...(slops ? { slopsDebug: { layer: slopsLayer, after: 'pathEditingOverlay' } } : {}),
  }), [merged, sceneLayers, selectionOverlayLayer, previewLayer, dispatcherOverlay, pathEditingOverlayLayer, slops, slopsLayer]);

  return { layers, rotationBadge, chromeAffordancesRef };
}
