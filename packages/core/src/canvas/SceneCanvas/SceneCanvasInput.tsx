import { useLatest } from '@weasel-js/react';
import type { Dispatcher } from '@weasel-js/routing';
import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { RuleCtx } from 'features/chrome-caps';
import type { Affordance } from 'affordances/types';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { UseResizeOptions } from 'interactions/actions/resize/options';
import { useEffect, type MutableRefObject, type RefObject } from 'react';
import { dlog } from '../../debug/flag';
import { useDeviceProfile } from '../../core/device/useDeviceProfile';
import { useTestHook } from '../../test-hook/useTestHook';
import type { CanvasExtensionApi } from '../canvasExtension';
import { useHitObserver } from '../useHitObserver';
import type { CanvasViewState } from '../useCanvasView';
import { GeometryProjectionRegistrar, ResizePolicyRegistrar } from './poseRegistrars';
import { usePointerPublisher } from './PointerProviderIfRoot';
import type { BridgeAdapter, SceneCanvasProps } from './props';
import type { NodeAtPoint } from './useNodeAtPoint';
import type { useSceneCanvasTools } from './useSceneCanvasTools';
import { useSceneGestureDispatcher } from './useSceneGestureDispatcher';
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
  | 'claimKeys' | 'longPress' | 'modes' | 'versionCheck' | 'onClick' | 'onDoubleClick'
>;

/** What `<SceneCanvas>` hands {@link SceneCanvasInput}. */
export interface SceneCanvasInputProps {
  props: SceneCanvasInputOptions;
  scene: Scene<unknown, string, unknown>;
  selection: SelectionApi;
  descriptor: PoseDescriptor<unknown>;
  picking: Pick<
    Picking, 'pickEvery' | 'pickBest' | 'boundsOf' | 'planeOfNode' | 'kindOfNode' | 'viewLayerGate' | 'alphaOf'
  > & { adapter: BridgeAdapter };
  /** The node a hit resolves to, for the `onClick` / `onDoubleClick` observers. */
  nodeAtPointRef: MutableRefObject<NodeAtPoint | undefined>;
  tools: ReturnType<typeof useSceneCanvasTools>;
  rotateOff: boolean;
  viewOn: boolean;
  camera: { viewState: CanvasViewState; viewAnimation: SceneStandardActionsInputs['viewAnimation'] };
  dispatcher: Dispatcher;
  pathEdit: {
    state: SceneStandardActionsInputs['editAnchorsExternalState'];
    snapper: SceneStandardActionsInputs['pathSnapper'];
  };
  chrome: { getIsVisible: () => (id: string) => boolean; getRuleCtx: () => RuleCtx | undefined };
  /** The selection overlay's rotate badge, and where the dispatcher reports the affordances
   *  it hit-tests, for the slops overlay. */
  overlay: {
    rotationBadge: { distancePx: number; sizePx: number } | null | undefined;
    chromeAffordancesRef: MutableRefObject<readonly Affordance[]>;
  };
  canvas: {
    elementRef: MutableRefObject<HTMLElement | null>;
    apiRef: RefObject<CanvasExtensionApi | null>;
    ready: boolean;
  };
  ingestionClipboard: SceneStandardActionsInputs['ingestionClipboard'];
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
  useEffect(() => {
    dlog('scene-canvas', 'mount');
    return () => dlog('scene-canvas', 'unmount');
  }, []);
  usePointerPublisher(canvas.elementRef, canvas.apiRef);
  useSceneStandardActions({
    props, rotateOff: p.rotateOff, viewOn: p.viewOn,
    selection, scene, adapter: picking.adapter, standardActions: p.tools.standardActions,
    currentViewRef: viewState.viewRef, onViewChange: viewState.setViewFromInput,
    poseDescriptor: p.descriptor, dispatcher: p.dispatcher,
    pickEvery: picking.pickEvery, layerIsPainted: picking.viewLayerGate, alphaOf: picking.alphaOf,
    viewAnimation: p.camera.viewAnimation, editAnchorsExternalState: p.pathEdit.state, pathSnapper: p.pathEdit.snapper,
    canvasRef: canvas.elementRef, canvasApiRef: canvas.apiRef, ingestionClipboard: p.ingestionClipboard,
  });

  // Rides the gesture dispatcher as an OBSERVER rather than an Action binding because the
  // prop is a notification, not a behavior: as a binding it would lose first-match-wins to
  // `enterPathEdit` on every body hit and silently stop firing.
  const onDoubleClick = useHitObserver(props.onDoubleClick, p.nodeAtPointRef);
  const onClick = useHitObserver(props.onClick, p.nodeAtPointRef);
  const selectionRef = useLatest(selection);
  const { targetScale } = useDeviceProfile();
  useSceneGestureDispatcher({
    canvasRef: canvas.elementRef, canvasApiRef: canvas.apiRef,
    tools: p.tools.tools, contributions: p.tools.contributions,
    enabled: props.enableGestureDispatcher ?? true, keyboard: enableKeybindings,
    claimKeys: props.claimKeys ?? false,
    selectionRef,
    boundsOf: picking.boundsOf, planeOfNode: picking.planeOfNode,
    pickEvery: picking.pickEvery, pickBest: picking.pickBest, kindOfNode: picking.kindOfNode,
    viewRef: viewState.viewRef, dispatcher: p.dispatcher,
    getIsVisibleForCanvas: chrome.getIsVisible, getRuleCtx: chrome.getRuleCtx,
    targetScale, handleHitRadius: selectTool?.handleHitRadius,
    rotationBadge: overlay.rotationBadge, chromeAffordancesRef: overlay.chromeAffordancesRef,
    onDoubleClick, onClick, longPress: props.longPress,
  });
  useToolKeybindings({
    internalTools: p.tools.internal,
    toolsTakeover: p.tools.takeover ?? undefined,
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
