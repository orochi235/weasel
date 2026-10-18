import { useLatest } from '@weasel-js/react';
import { createLongPressStore, type Dispatcher } from '@weasel-js/routing';
import { useActionsRegistry, useDepRegistry, useGestureDispatcher, type DepRegistry } from '@weasel-js/routing/react';
import type { Affordance } from 'affordances/types';
import { EMPTY_CHROME_STATE } from 'core/selection/chromeState';
import type { View } from 'core/viewport/view';
import type { RuleCtx } from 'features/chrome-caps';
import type React from 'react';
import { useCallback, useInsertionEffect, useMemo, useState } from 'react';
import type { Contribution } from '../../tools/overlayBinding';
import type { ToolsApi } from '../../tools/overlayBinding';
import { useDispatchDepSources } from '../deps/dispatchSources';
import { anchorStateFrom, buildAffordanceAt, buildClassifyTarget, layerAffordance } from '../affordanceAt';
import { useChromeAffordances } from './useChromeAffordances';
import type { CanvasExtensionApi } from '../canvasExtension';
import { useKitSettingsDepSource } from '../deps/kitSettings';
import { pathFromPlane } from '../planeClips';
import { useOptionalViewRegistry, type ViewRegistry } from '../viewRegistry';
import { useSurfaceRouting } from './useSurfaceRouting';
import { traceConversion } from './coordTrace';
import type { SceneCanvasLongPress } from './props';

/** What `<SceneCanvas>` hands {@link useSceneGestureDispatcher}. */
export interface SceneGestureDispatcherInputs {
  canvasRef: React.RefObject<HTMLElement | null>;
  /** Holds the full `CanvasExtensionApi` so the gesture dispatcher can call
   *  `requestRedraw()` between pointer events. */
  canvasApiRef: React.RefObject<CanvasExtensionApi | null>;
  tools: ToolsApi;
  /** Always-live entries the canvas installs beside `tools` — the selection's
   *  `move` / `transform` bindings. Ahead of the tools' ambient entries, so a
   *  tie at one specificity goes to the kit's. */
  contributions: readonly Contribution[];
  enabled: boolean;
  /** When false, the dispatcher leaves keyboard listeners unattached so
   *  keyboard-bound actions never fire. Wired to `enableKeybindings`. */
  keyboard: boolean;
  /** Take the keyboard on mount. Wired to `claimKeys`. */
  claimKeys: boolean;
  selectionRef?: React.RefObject<import('core/selection/useSelection').SelectionApi>;
  boundsOf?: (id: string) => import('core/viewport/fitViewToBounds').Bounds | null;
  /** The parallax plane a node is drawn through, under the surface's camera —
   *  so path anchors are hit where the plane draws them. */
  planeOfNode?: (id: string) => import('core/viewport/parallax').PlaneMap | null;
  pickEvery?: (worldX: number, worldY: number) => string[];
  /** Single topmost hit (collapses parent/child via `pickTopMostHit`), used to
   *  classify the body under the pointer. Must match the select tool's own
   *  resolution so a child node isn't misclassified by its parent's selection.
   *  Falls back to `pickEvery`'s last id when absent. */
  pickBest?: (worldX: number, worldY: number) => string | null;
  /** Resolves a hit node id to its routing-trait kind, so the body
   *  classification carries `kind` alongside `bodyTarget` and the
   *  `kind:<k>` / `kind:<k>:selected` target forms can match. Absent when
   *  the consumer opted out of routing (`routing={[]}`). */
  kindOfNode?: (id: string) => string | undefined;
  /** The node a double-click on a hit names (`doubleClickTarget`), for the classification. */
  doubleClickNames?: (hitId: string) => string;
  viewRef?: React.RefObject<View>;
  /** Pre-created dispatcher to pump events into. When omitted,
   *  `useGestureDispatcher` creates one internally (legacy path). */
  dispatcher?: Dispatcher;
  /** Chrome-caps visibility resolver factory. Threaded into
   *  `buildAffordanceAt` so the hit-test pipeline gates corner / rotate /
   *  anchor affordances on the same chrome ids the renderer uses. */
  getIsVisibleForCanvas?: () => (id: string) => boolean;
  /** Live RuleCtx factory. Threaded into `useGestureDispatcher` so the
   *  dispatcher's eligibility filter sees the same mode/capabilities/selection
   *  view of the world that chrome-caps does. */
  getRuleCtx?: () => RuleCtx | undefined;
  /** `DeviceProfile.targetScale`, so the affordance grab zones resolve to the
   *  same sizes the chrome paints at. */
  targetScale?: number;
  /** Consumer override for the corner-handle grab radius
   *  (`selectTool.handleHitRadius`). Undefined takes the device-scaled size. */
  handleHitRadius?: number;
  /** `selectTool.resize.edgeHandles`: resize handles at the edge midpoints. Default true. */
  edgeHandles?: boolean;
  /** The rotate badge the selection overlay paints, grabbable where drawn. */
  rotationBadge?: { distancePx: number; sizePx: number } | null;
  /** Receives the affordances this mounter hit-tests, for the slops overlay. */
  chromeAffordancesRef?: React.MutableRefObject<readonly Affordance[]>;
  /** Fires on every synthesized double click, in world coords. Backs the
   *  `onDoubleClick` prop — see the option's doc on
   *  `UseGestureDispatcherOptions` for why it's an observer, not a binding. */
  onDoubleClick?: (world: { x: number; y: number }) => void;
  /** Fires after every synthesized click. Backs the `onClick` prop. */
  onClick?: (world: { x: number; y: number }) => void;
  /** Backs `<SceneCanvas longPress>`. */
  longPress?: SceneCanvasLongPress;
}

type AffordanceInputs = Pick<
  SceneGestureDispatcherInputs,
  | 'canvasApiRef' | 'selectionRef' | 'boundsOf' | 'planeOfNode' | 'viewRef' | 'getIsVisibleForCanvas'
  | 'targetScale' | 'handleHitRadius' | 'edgeHandles' | 'rotationBadge' | 'chromeAffordancesRef'
>;

/** What a press on the canvas grabs: a registered layer's widget, else a piece of the
 *  selection chrome. */
function useAffordanceAt(inputs: AffordanceInputs, depRegistry: DepRegistry, viewRegistry: ViewRegistry | null) {
  const {
    canvasApiRef, selectionRef, boundsOf, planeOfNode, viewRef, getIsVisibleForCanvas,
    targetScale, handleHitRadius, edgeHandles, rotationBadge, chromeAffordancesRef,
  } = inputs;
  // `getAnchorState` thunk for `buildAffordanceAt` — reads the live
  // `editAnchors` dep from the registry at call time.
  const depRegistryRef = useLatest(depRegistry);
  const planeOfNodeRef = useLatest(planeOfNode);
  const getAnchorState = useMemo(() => anchorStateFrom(
    () => depRegistryRef.current,
    (id, path) => pathFromPlane(path, planeOfNodeRef.current?.(id) ?? null),
  ), [depRegistryRef, planeOfNodeRef]);

  // Build the `affordanceAt` thunk. Takes world coords and delegates to
  // `buildAffordanceAt` for handle hit-testing.
  const affordances = useChromeAffordances({ targetScale, handleHitRadius, edgeHandles, rotationBadge, getAnchorState });
  useInsertionEffect(() => {
    if (chromeAffordancesRef) chromeAffordancesRef.current = affordances;
  });
  const affordanceAt = useMemo(() => {
    if (!selectionRef || !boundsOf || !viewRef) return undefined;
    return buildAffordanceAt({
      // The canvas's own view chrome, built once by its helpers — not a
      // second construction here that has to agree with the painted one.
      getChromeState: () => viewRegistry?.surface()?.chromeState() ?? EMPTY_CHROME_STATE,
      // Radii are declared in screen pixels and converted against this view.
      getView: () => viewRef.current ?? { x: 0, y: 0, scale: { x: 1, y: 1 } },
      affordances,
      // Chrome-caps resolver: keep the affordance hit-test in sync with what
      // the renderer is actually painting. Without this, a click on a (no
      // longer visible) resize handle position still classifies as a resize
      // handle — e.g. an anchor drag in path-edit mode resizes the path's
      // bounding box instead of moving the anchor.
      ...(getIsVisibleForCanvas ? { getIsVisible: () => getIsVisibleForCanvas() } : {}),
    });
  }, [selectionRef, boundsOf, viewRef, affordances, getIsVisibleForCanvas, viewRegistry]);

  return useMemo(() => {
    // Note this is NOT gated on `affordanceAt` being built: registered layers
    // produce affordances of their own, and a consumer with no selection
    // chrome (a canvas that is nothing but a HUD, say) still needs those.
    return (worldPoint: { x: number; y: number }) => {
      // Registered layers first: they draw on top of the kit's own chrome, so
      // they get first refusal on the point. A hit becomes an `AffordanceHit`
      // whose kind names the layer, carrying whatever the layer's hit-test
      // resolved — which is how `@weasel-js/hud` routes a press on one of its
      // widgets to its own action instead of the active tool.
      const extra = canvasApiRef.current?.hitTestExtras?.(worldPoint.x, worldPoint.y);
      if (extra) return layerAffordance(extra.layerId, extra.hit);
      return affordanceAt ? affordanceAt(worldPoint) : null;
    };
  }, [affordanceAt, canvasApiRef]);
}

/** Which body a world point lands on, its selection state, and its routing kind. */
function useClassifyTarget(
  inputs: Pick<SceneGestureDispatcherInputs, 'selectionRef' | 'pickEvery' | 'pickBest' | 'viewRef' | 'doubleClickNames'>,
  kindOfNodeRef: { readonly current: SceneGestureDispatcherInputs['kindOfNode'] },
) {
  const { selectionRef, pickEvery, pickBest, viewRef } = inputs;
  // Stable refs for the optional thunk inputs so the thunks themselves are
  // stable function identities across renders (no need to pass them as deps).
  const pickEveryRef = useLatest(pickEvery);
  const pickBestRef = useLatest(pickBest);
  const doubleClickNamesRef = useLatest(inputs.doubleClickNames);
  // Build the `classifyTarget` thunk. Takes world coords and delegates to
  // `buildClassifyTarget`.
  return useMemo(() => {
    if (!selectionRef || !pickEvery || !viewRef) return undefined;
    return buildClassifyTarget(
      () => selectionRef.current?.current ?? [],
      // Use the select tool's own topmost-hit resolution (`pickTopMostHit`,
      // which collapses parent/child) so a child body is classified by ITS
      // OWN selection — not its parent's.
      (wx: number, wy: number) => {
        if (pickBestRef.current) return pickBestRef.current(wx, wy);
        const ids = pickEveryRef.current?.(wx, wy) ?? [];
        return ids.length > 0 ? ids[ids.length - 1] : null;
      },
      // Node kind comes from the routing trait — the same classifier that
      // names `Hit.kind` — so `target: 'kind:text'` on a binding speaks the
      // vocabulary the consumer already declared in `routing`, rather than a
      // second one invented for bindings. `routing={[]}` opts out and leaves
      // every `kind:` target unmatchable.
      (id: string) => kindOfNodeRef.current?.(id),
      (id: string) => doubleClickNamesRef.current?.(id) ?? id,
    );
  }, [selectionRef, pickEvery, viewRef, pickBestRef, pickEveryRef, kindOfNodeRef, doubleClickNamesRef]);
}

/** Runs this canvas's gesture dispatcher over its tools, contributions, and chrome. */
export function useSceneGestureDispatcher(inputs: SceneGestureDispatcherInputs): void {
  const {
    canvasRef, canvasApiRef, tools, contributions, enabled, keyboard, claimKeys, viewRef,
    kindOfNode, dispatcher, getRuleCtx, onDoubleClick, onClick,
    longPress: { duration: longPressDuration, haptics: longPressHaptics } = {},
  } = inputs;
  const registry = useActionsRegistry();
  const depRegistry = useDepRegistry();
  const viewRegistry = useOptionalViewRegistry();
  const entriesById = useMemo<ReadonlyMap<string, Contribution>>(() => {
    const m = new Map<string, Contribution>();
    for (const [id, tool] of Object.entries(tools.registry)) {
      m.set(id, tool);
    }
    for (const entry of contributions) m.set(entry.id, entry);
    // Ambient entries too — their bindings assemble at ambient scope, and the
    // dispatcher resolves them through this same map.
    for (const entry of tools.ambient) m.set(entry.id, entry);
    return m;
  }, [tools.registry, tools.ambient, contributions]);

  const kindOfNodeRef = useLatest(kindOfNode);

  const affordanceWithLayers = useAffordanceAt(inputs, depRegistry, viewRegistry);
  const classifyTarget = useClassifyTarget(inputs, kindOfNodeRef);

  // Through the handle, so a `clientToWorld` override on the canvas applies.
  const clientToWorld = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const api = canvasApiRef.current;
    const [x, y] = api ? api.clientToWorld(clientX, clientY) : [clientX, clientY];
    const world = { x, y };
    traceConversion(clientX, clientY, api ? canvasRef.current : null, viewRef?.current, world);
    return world;
  }, [canvasRef, canvasApiRef, viewRef]);

  // Stable callback that asks the canvas to redraw. Reads via ref so the
  // identity stays stable while the underlying API binds after mount.
  const requestRedraw = useCallback(() => {
    canvasApiRef.current?.requestRedraw?.();
  }, [canvasApiRef]);

  // The painted tier's channel, read live for the same reason — the handle it
  // lives on binds after mount.
  const paintedCursor = useCallback(() => canvasApiRef.current?.paintedCursor, [canvasApiRef]);
  const cursorSink = useCallback(() => canvasApiRef.current?.cursorSink, [canvasApiRef]);

  // The pending long-press, published as the `longPress` dep for feedback.
  const [longPressState] = useState(createLongPressStore);
  const longPress = useMemo(() => ({
    state: longPressState,
    ...(longPressDuration !== undefined ? { duration: longPressDuration } : {}),
    ...(longPressHaptics !== undefined ? { haptics: longPressHaptics } : {}),
  }), [longPressState, longPressDuration, longPressHaptics]);

  const routing = useSurfaceRouting(viewRegistry);

  // Hover cursors live in `useGestureDispatcher`'s hover-cursor pump:
  // affordance hits carry `AffordanceHit.cursor` (set by `buildAffordanceAt`),
  // and everything else is predicted via `Dispatcher.resolveOnly` +
  // `Action.cursor`. Nothing SceneCanvas-specific remains here.
  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    entriesById,
    enabled,
    keyboard,
    claimKeys,
    affordanceAt: affordanceWithLayers,
    classifyTarget,
    dispatcher,
    clientToWorld,
    requestRedraw,
    paintedCursor,
    cursorSink,
    getRuleCtx,
    onClick,
    onDoubleClick,
    longPress,
    ...routing,
  });
  useDispatchDepSources(longPressState, classifyTarget, kindOfNodeRef);
  useKitSettingsDepSource();
}
