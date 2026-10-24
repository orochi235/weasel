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
import { targetSizesPx } from 'core/device/targets';
import type { ResizeHandleLayout } from 'interactions/actions/resize/cornerHandles';
import { mergeLayersWithDefaults } from './mergeLayers';
import type { SceneCanvasLayers } from './props';
import { useDispatcherOverlayLayer } from './useDispatcherOverlayLayer';
import { usePreviewGhostLayer } from './usePreviewGhostLayer';
import { useDepartureGhostLayer } from './useDepartureGhostLayer';
import { useEffectSourcesLayer } from 'features/pathEffects/useEffectSourcesLayer';
import type { Departures } from '../../animation/departures';
import { usePoseTransition, type PoseTransitionSeat } from '../../animation/poseTransition';
import { useSceneSlotLayers } from './useSceneSlotLayers';
import { useSelectionOverlayLayer } from './useSelectionOverlayLayer';
import { drawnBoundsScene } from '../derivedPath';
import { useEnteredGroupFrameLayer } from 'features/selection/enteredGroupFrame';
import type { EnteredGroupApi } from '../deps/enteredGroup';
import { createSnapOutcomeStore, type SnapOutcomeStore } from 'features/snap/outcomeStore';
import { createSnapReadoutLayer } from 'features/snap/readoutLayer';
import type { SnapReadoutStyle } from 'features/snap/types';

/**
 * The layer map `<SceneCanvas>` hands `<Canvas>`: the caller's `layers` over
 * the kit defaults, with the scene and selection-overlay slots built, and the
 * canvas's own layers anchored around them. Removed nodes leave just above
 * the scene, the preview ghost above them, a selected path effect's hidden sources above that, the dispatcher's
 * overlay (marquee, lasso) above those, and the
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
  boundsOf: (id: string) => Bounds | null; enteredGroup: EnteredGroupApi; frameColor: { read: () => string; changed: (fn: () => void) => () => void };
  planeOfNode: (id: string, view: View) => PlaneMap | null;
  /** `<SceneCanvas poseTransition>`, whose ghosts of removed nodes this draws. */
  poseTransition: PoseTransitionSeat<TPose> | null | undefined;
  /** Ids an in-flight gesture is ghosting. */
  previewIds: () => Iterable<string> | null;
  dispatcher: Dispatcher;
  /** Whether to mount the snap readout layer. */
  snapReadout: boolean;
  snapReadoutStyle?: SnapReadoutStyle;
  pathEditState: PathEditState;
  /** `debug.slops`: paint the hit regions of the chrome affordances. */
  slops: boolean;
  /** `geometry.boundsIncludeStroke`: whether chrome sits on the stroke. */
  boundsIncludeStroke: boolean;
  /** `selectTool`'s `handleHitRadius` and `resize.edgeHandles`, resolved here into
   *  the one {@link ResizeHandleLayout} the overlay paints and the hit-test reads. */
  selectTool?: { handleHitRadius?: number; resize?: { edgeHandles?: boolean } };
}): {
  layers: CanvasLayers;
  /** Where the selection overlay paints its rotate badge, or null. */
  rotationBadge: ReturnType<typeof rotationBadgeOf>;
  /** Which resize handles exist and their hit radius, for every hit-test of this canvas. */
  resizeHandles: ResizeHandleLayout;
  /** The affordances the gesture mounter hit-tests, which it publishes here
   *  so the slops halos are the hit regions rather than a copy of them. */
  chromeAffordancesRef: MutableRefObject<readonly Affordance[]>;
  /** The marks the readout layer draws; the canvas's snap dep writes them. */
  snapStore: SnapOutcomeStore;
  /** The removed nodes the seat is seeing off. */
  departures: Departures<TPose, Node<TData, TLayer, TPose>>;
} {
  const { scene, adapter, poseDescriptor, alphaFor, dispatcher, pathEditState, slops, targetScale } = args;

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
  const effectSourcesLayer = useEffectSourcesLayer(scene);
  const dispatcherOverlay = useDispatcherOverlayLayer({ dispatcher });

  const hitRadiusPx = args.selectTool?.handleHitRadius ?? targetSizesPx(targetScale, baseSizes).handle;
  const edges = args.selectTool?.resize?.edgeHandles ?? true;
  const resizeHandles = useMemo<ResizeHandleLayout>(() => ({ edges, hitRadiusPx }), [edges, hitRadiusPx]);

  const chromeAffordancesRef = useRef<readonly Affordance[]>([]);
  const slopsLayer = useMemo(
    () => createSlopsDebugLayer({ getAffordances: () => chromeAffordancesRef.current }),
    [],
  );

  const [snapStore] = useState(() => createSnapOutcomeStore());
  // Keyed on the style's values, so an inline `readoutStyle` literal keeps the layer.
  const { color, gapColor, lineWidth } = args.snapReadoutStyle ?? {};
  const snapReadoutLayer = useMemo(() => createSnapReadoutLayer(snapStore, {
    ...(color !== undefined ? { color } : {}),
    ...(gapColor !== undefined ? { gapColor } : {}),
    ...(lineWidth !== undefined ? { lineWidth } : {}),
  }), [snapStore, color, gapColor, lineWidth]);
  const overlaySlot = merged.pathEditingOverlay;
  const overlayConfig = overlaySlot && !isCustomEntry(overlaySlot) ? overlaySlot : undefined;
  const overlayAnchor = overlaySlot === null ? 'dispatcherOverlay' : 'pathEditingOverlay';
  const pathEditingOverlayLayer = usePathEditOverlayLayer(pathEditState, {
    nodeOf: (id) => scene.get(id as NodeId),
    planeOfNode: args.planeOfNode,
  }, overlayConfig);

  const { layer: selectionOverlayLayer, rotationBadge } = useSelectionOverlayLayer<TPose>(
    merged.selectionOverlay,
    pathEditState.getEditingIds,
    poseDescriptor,
    args.boundsIncludeStroke ? drawnBoundsScene(scene) : undefined,
    resizeHandles,
  );

  const enteredFrameLayer = useEnteredGroupFrameLayer(args.enteredGroup, args.boundsOf, args.frameColor);
  const layers = useMemo<CanvasLayers>(() => ({
    ...builtLayersOf(merged),
    scene: sceneLayers,
    selectionOverlay: selectionOverlayLayer ? { layer: selectionOverlayLayer } : null,
    enteredGroupFrame: { layer: enteredFrameLayer, before: 'selectionOverlay' },
    departureGhost: { layer: departureLayer, after: 'scene' },
    previewGhost: { layer: previewLayer, after: 'departureGhost' },
    effectSources: { layer: effectSourcesLayer, after: 'previewGhost' },
    dispatcherOverlay: { layer: dispatcherOverlay, after: 'effectSources' },
    pathEditingOverlay: overlaySlot === null || isCustomEntry(overlaySlot)
      ? overlaySlot
      : { layer: pathEditingOverlayLayer, after: 'selectionOverlay' },
    ...(args.snapReadout ? { snapReadout: { layer: snapReadoutLayer, after: overlayAnchor } } : {}),
    ...(slops ? { slopsDebug: { layer: slopsLayer, after: args.snapReadout ? 'snapReadout' : overlayAnchor } } : {}),
  }), [merged, sceneLayers, selectionOverlayLayer, enteredFrameLayer, departureLayer, previewLayer, effectSourcesLayer, dispatcherOverlay, pathEditingOverlayLayer, overlaySlot, overlayAnchor, snapReadoutLayer, args.snapReadout, slops, slopsLayer,
  ]);

  return { layers, rotationBadge, resizeHandles, chromeAffordancesRef, snapStore, departures };
}
