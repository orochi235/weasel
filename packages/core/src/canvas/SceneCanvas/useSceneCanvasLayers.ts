import { useMemo, useRef, useState, type MutableRefObject } from 'react';
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
import { builtLayersOf, isCustomEntry, type CanvasLayers } from '../layerSlots';
import { createSlopsDebugLayer } from '../slopsDebugLayer';
import { useTargetBasePx } from 'core/device/useTargetBasePx';
import { mergeLayersWithDefaults, type SceneCanvasLayers } from './props';
import { useDispatcherOverlayLayer } from './useDispatcherOverlayLayer';
import { usePreviewGhostLayer } from './usePreviewGhostLayer';
import { useDepartureGhostLayer } from './useDepartureGhostLayer';
import type { Departures } from '../../animation/departures';
import { usePoseTransition, type PoseTransitionSeat } from '../../animation/poseTransition';
import { useSceneSlotLayers } from './useSceneSlotLayers';
import { useSelectionOverlayLayer } from './useSelectionOverlayLayer';
import type { DrawnBoundsScene } from '../drawnBounds';
import type { PathSnapper } from 'features/paths/pathSnap/pathSnapper';
import { createPathSnapMarkerLayer } from 'features/paths/pathSnap/pathSnapMarkerLayer';
import { createSnapOutcomeStore, type SnapOutcomeStore } from 'features/snap/outcomeStore';
import { createSnapReadoutLayer, type SnapReadoutStyle } from 'features/snap/readoutLayer';

/**
 * The layer map `<SceneCanvas>` hands `<Canvas>`: the caller's `layers` over
 * the kit defaults, with the scene and selection-overlay slots built, and the
 * canvas's own layers anchored around them. Removed nodes leave just above
 * the scene, the preview ghost above them, the dispatcher's overlay (marquee, lasso) above the ghost, and the
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
  /** `<SceneCanvas poseTransition>`, whose ghosts of removed nodes this draws. */
  poseTransition: PoseTransitionSeat<TPose> | null | undefined;
  /** Ids an in-flight gesture is ghosting. */
  previewIds: () => Iterable<string> | null;
  dispatcher: Dispatcher;
  /** Whose mark the snap-marker layer draws. */
  pathSnapper: PathSnapper;
  snapReadout: boolean;
  snapReadoutStyle?: SnapReadoutStyle;
  pathEditState: PathEditState;
  /** `debug.slops`: paint the hit regions of the chrome affordances. */
  slops: boolean;
  /** `geometry.boundsIncludeStroke`: whether chrome sits on the stroke. */
  boundsIncludeStroke: boolean;
}): {
  layers: CanvasLayers;
  /** Where the selection overlay paints its rotate badge, or null. */
  rotationBadge: ReturnType<typeof rotationBadgeOf>;
  /** The affordances the gesture mounter hit-tests, which it publishes here
   *  so the slops halos are the hit regions rather than a copy of them. */
  chromeAffordancesRef: MutableRefObject<readonly Affordance[]>;
  /** The marks the readout layer draws; the canvas's snap dep writes them. */
  snapStore: SnapOutcomeStore;
  /** The removed nodes the seat is seeing off. */
  departures: Departures<TPose, Node<TData, TLayer, TPose>>;
} {
  const { scene, adapter, poseDescriptor, alphaFor, dispatcher, pathEditState, slops, targetScale, pathSnapper } = args;

  const baseSizes = useTargetBasePx();
  const merged = useMemo(
    () => mergeLayersWithDefaults(args.layers, targetScale, baseSizes),
    [args.layers, targetScale, baseSizes],
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
  const departures = usePoseTransition(scene, args.poseTransition);
  const departureLayer = useDepartureGhostLayer({ scene, sceneSlot, departures });
  const dispatcherOverlay = useDispatcherOverlayLayer({ dispatcher });

  const chromeAffordancesRef = useRef<readonly Affordance[]>([]);
  const slopsLayer = useMemo(
    () => createSlopsDebugLayer({ getAffordances: () => chromeAffordancesRef.current }),
    [],
  );

  const snapMarkerLayer = useMemo(() => createPathSnapMarkerLayer(pathSnapper), [pathSnapper]);
  const [snapStore] = useState(() => createSnapOutcomeStore());
  const snapReadoutLayer = useMemo(() => createSnapReadoutLayer(snapStore, args.snapReadoutStyle), [snapStore, args.snapReadoutStyle]);
  const overlaySlot = merged.pathEditingOverlay;
  const overlayConfig = overlaySlot && !isCustomEntry(overlaySlot) ? overlaySlot : undefined;
  const pathEditingOverlayLayer = usePathEditOverlayLayer(pathEditState, {
    nodeOf: (id) => scene.get(id as NodeId),
    planeOfNode: args.planeOfNode,
  }, overlayConfig);

  const { layer: selectionOverlayLayer, rotationBadge } = useSelectionOverlayLayer<TPose>(
    merged.selectionOverlay,
    pathEditState.getEditingIds,
    poseDescriptor,
    args.boundsIncludeStroke ? (scene as unknown as DrawnBoundsScene) : undefined,
  );

  const layers = useMemo<CanvasLayers>(() => ({
    ...builtLayersOf(merged),
    scene: sceneLayers,
    selectionOverlay: selectionOverlayLayer ? { layer: selectionOverlayLayer } : null,
    departureGhost: { layer: departureLayer, after: 'scene' },
    previewGhost: { layer: previewLayer, after: 'departureGhost' },
    dispatcherOverlay: { layer: dispatcherOverlay, after: 'previewGhost' },
    pathEditingOverlay: overlaySlot === null || isCustomEntry(overlaySlot)
      ? overlaySlot
      : { layer: pathEditingOverlayLayer, after: 'selectionOverlay' },
    pathSnapMarker: { layer: snapMarkerLayer, after: overlaySlot === null ? 'dispatcherOverlay' : 'pathEditingOverlay' },
    ...(args.snapReadout ? { snapReadout: { layer: snapReadoutLayer, after: 'pathSnapMarker' } } : {}),
    ...(slops ? { slopsDebug: { layer: slopsLayer, after: args.snapReadout ? 'snapReadout' : 'pathSnapMarker' } } : {}),
  }), [
    merged, sceneLayers, selectionOverlayLayer, departureLayer, previewLayer, dispatcherOverlay, pathEditingOverlayLayer, overlaySlot,
    snapMarkerLayer, snapReadoutLayer, args.snapReadout, slops, slopsLayer,
  ]);

  return { layers, rotationBadge, chromeAffordancesRef, snapStore, departures };
}
