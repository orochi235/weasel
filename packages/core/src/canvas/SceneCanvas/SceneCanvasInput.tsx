import type { ResizeHandleLayout } from 'interactions/actions/resize/cornerHandles';
import { useLatest } from '@weasel-js/react';
import type { Dispatcher } from '@weasel-js/routing';
import { useDepSource } from '@weasel-js/routing/react';
import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { RuleCtx } from 'domains/chrome-caps';
import type { Affordance } from 'affordances/types';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { UseResizeOptions } from 'interactions/actions/resize/options';
import { useContext, useEffect, type MutableRefObject, type RefObject } from 'react';
import { SnapSourceRegistryContext } from 'domains/snap/registry';
import type { SnapOutcomeStore } from 'domains/snap/outcomeStore';
import type { SnapSource } from 'domains/snap/types';
import { dlog } from '../../debug/flag';
import { useDeviceProfile } from '../../core/device/useDeviceProfile';
import { useTestHook } from '../../test-hook/useTestHook';
import type { CanvasExtensionApi } from '../canvasExtension';
import type { ChromeRulesDep } from '../deps/chromeRules';
import { useHitObserver } from '../useHitObserver';
import type { CanvasViewState } from '../useCanvasView';
import { GeometryProjectionRegistrar, ResizePolicyRegistrar } from './poseRegistrars';
import { usePointerPublisher } from './PointerProviderIfRoot';
import type { BridgeAdapter, SceneCanvasProps } from './props';
import type { NodeAtPoint } from './useNodeAtPoint';
import type { useSceneCanvasTools } from './useSceneCanvasTools';
import { useSceneGestureDispatcher } from './useSceneGestureDispatcher';
import { useCanvasDevtoolsRoot, type CanvasDevtools } from './useCanvasDevtoolsRoot';
import type { useScenePicking } from './useScenePicking';
import {
  useSceneStandardActions, type SceneStandardActionsInputs, type StandardActionsProps,
} from './useSceneStandardActions';
import { useToolKeybindings } from './useToolKeybindings';

type Props = SceneCanvasProps<unknown, string, unknown>;
type Picking = ReturnType<typeof useScenePicking<unknown, string, unknown>>;

/** The `<SceneCanvas>` props its input wiring reads. */
export type SceneCanvasInputOptions = StandardActionsProps & Pick<
  Props,
  | 'selectTool' | 'geometryProjection' | 'enableGestureDispatcher' | 'enableKeybindings'
  | 'claimKeys' | 'longPress' | 'modes' | 'versionCheck' | 'onClick' | 'onDoubleClick' | 'routing'
>;

/** What `<SceneCanvas>` hands {@link SceneCanvasInput}. */
export interface SceneCanvasInputProps {
  props: SceneCanvasInputOptions;
  scene: Scene<unknown, string, unknown>;
  selection: SelectionApi;
  descriptor: PoseDescriptor<unknown>;
  picking: Pick<
    Picking, 'pickEvery' | 'pickBest' | 'boundsOf' | 'planeOfNode' | 'kindOfNode' | 'doubleClickNames' | 'viewLayerGate' | 'alphaOf' | 'enteredGroup' | 'reachable'
  > & { adapter: BridgeAdapter };
  /** The node a hit resolves to, for the `onClick` / `onDoubleClick` observers. */
  nodeAtPointRef: MutableRefObject<NodeAtPoint | undefined>;
  tools: ReturnType<typeof useSceneCanvasTools>;
  viewOn: boolean;
  camera: { viewState: CanvasViewState; viewAnimation: SceneStandardActionsInputs['viewAnimation'] };
  dispatcher: Dispatcher;
  pathEdit: {
    state: SceneStandardActionsInputs['editAnchorsExternalState'];
  };
  chrome: {
    getIsVisible: () => (id: string) => boolean;
    getRuleCtx: () => RuleCtx | undefined;
    chromeRules: ChromeRulesDep;
  };
  /** The selection overlay's rotate badge, and where the dispatcher reports the affordances
   *  it hit-tests, for the slops overlay. */
  overlay: {
    rotationBadge: { distancePx: number; sizePx: number } | null | undefined;
    /** The resize-handle layout the overlay paints, so the hit-test grabs exactly those. */
    resizeHandles: ResizeHandleLayout;
    chromeAffordancesRef: MutableRefObject<readonly Affordance[]>;
  };
  canvas: {
    elementRef: MutableRefObject<HTMLElement | null>;
    apiRef: RefObject<CanvasExtensionApi | null>;
    ready: boolean;
  };
  ingestionClipboard: SceneStandardActionsInputs['ingestionClipboard'];
  ingestionHandlers: SceneStandardActionsInputs['ingestionHandlers'];
  /** The enabled presets' snap sources. */
  snapSources: readonly SnapSource[];
  /** The outcome store the canvas's readout layer draws. */
  snapStore: SnapOutcomeStore;
  devtools: CanvasDevtools;
}

/**
 * The canvas's input wiring: the pointer publisher, the standard actions and their deps, the
 * gesture dispatcher, and the tool keybindings, in that order, then the test hook.
 *
 * A component of its own, mounted ahead of `<SceneCanvas>`'s children, rather than hooks in the
 * canvas's body: dep sources and actions stack newest-live in effect order, and a parent's
 * effects run after its children's, so a child overriding a kit dep would lose to it.
 */
export function SceneCanvasInput(p: SceneCanvasInputProps) {
  const { props, scene, selection, picking, chrome, overlay, canvas } = p;
  const { viewState } = p.camera;
  const { selectTool, enableKeybindings = true } = props;
  const snapRegistry = useContext(SnapSourceRegistryContext);
  useEffect(() => {
    dlog('scene-canvas', 'mount');
    return () => dlog('scene-canvas', 'unmount');
  }, []);
  usePointerPublisher(canvas.elementRef, canvas.apiRef);
  useDepSource('chromeRules', () => chrome.chromeRules);
  useSceneStandardActions({
    props, viewOn: p.viewOn,
    selection, enteredGroup: picking.enteredGroup, scene, adapter: picking.adapter, standardActions: p.tools.standardActions,
    currentViewRef: viewState.viewRef, onViewChange: viewState.setViewFromInput,
    poseDescriptor: p.descriptor, dispatcher: p.dispatcher,
    pickEvery: picking.pickEvery, layerIsPainted: picking.viewLayerGate, alphaOf: picking.alphaOf, reachable: picking.reachable,
    viewAnimation: p.camera.viewAnimation, editAnchorsExternalState: p.pathEdit.state,
    canvasRef: canvas.elementRef, canvasApiRef: canvas.apiRef, ingestionClipboard: p.ingestionClipboard,
    ingestionHandlers: p.ingestionHandlers,
    snap: { sources: [...(props.snap?.sources ?? []), ...p.snapSources], registry: snapRegistry, store: p.snapStore },
  });

  // Rides the gesture dispatcher as an OBSERVER rather than an Action binding because the
  // prop is a notification, not a behavior: as a binding it would lose first-match-wins to
  // `enterPathEdit` on every body hit and silently stop firing.
  const onDoubleClick = useHitObserver(props.onDoubleClick, p.nodeAtPointRef);
  const onClick = useHitObserver(props.onClick, p.nodeAtPointRef);
  const selectionRef = useLatest(selection);
  const { targetScale } = useDeviceProfile();
  const { root, traces } = useCanvasDevtoolsRoot({
    scene, selection, viewState, tools: p.tools.tools, contributions: p.tools.contributions, routing: props.routing,
    element: canvas.elementRef, api: canvas.apiRef, devtools: p.devtools,
  });
  useSceneGestureDispatcher({
    canvasRef: canvas.elementRef, canvasApiRef: canvas.apiRef,
    tools: p.tools.tools, contributions: p.tools.contributions,
    enabled: props.enableGestureDispatcher ?? true, keyboard: enableKeybindings,
    claimKeys: props.claimKeys ?? false,
    selectionRef,
    boundsOf: picking.boundsOf, planeOfNode: picking.planeOfNode,
    pickEvery: picking.pickEvery, pickBest: picking.pickBest, kindOfNode: picking.kindOfNode,
    doubleClickNames: picking.doubleClickNames,
    viewRef: viewState.viewRef, dispatcher: p.dispatcher, traces,
    getIsVisibleForCanvas: chrome.getIsVisible, getRuleCtx: chrome.getRuleCtx,
    targetScale, handleHitRadius: overlay.resizeHandles.hitRadiusPx,
    edgeHandles: overlay.resizeHandles.edges,
    rotationBadge: overlay.rotationBadge, chromeAffordancesRef: overlay.chromeAffordancesRef,
    onDoubleClick, onClick, longPress: props.longPress,
  });
  useToolKeybindings({
    internalTools: p.tools.internal,
    toolsTakeover: p.tools.takeover ?? undefined,
    surface: p.tools.surface,
    enableKeybindings,
    modes: props.modes,
    canvasApi: canvas.ready ? canvas.apiRef.current : null,
    versionCheck: props.versionCheck,
  });
  useTestHook({
    getScene: () => scene as never,
    getSelectionIds: () => (selection.current as readonly string[] | undefined) ?? [],
    getView: () => viewState.viewRef.current,
    getActiveToolId: () => p.tools.tools.active ?? null,
    probes: root.probes,
  });

  // Mounted only when passed: an empty default registered with the deps above would land
  // after, and over, a dep one of these registered (child effects run first). Absent
  // `geometryProjection` leaves the dep undefined.
  return (
    <>
      {selectTool?.resize
        ? <ResizePolicyRegistrar options={selectTool.resize as UseResizeOptions<unknown>} />
        : null}
      {props.geometryProjection ? <GeometryProjectionRegistrar projection={props.geometryProjection} /> : null}
    </>
  );
}
