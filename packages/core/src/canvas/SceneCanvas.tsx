/**
 * `<SceneCanvas>` — `<Canvas>` wired to a `Scene` primitive. Bare, it only renders: behavior
 * comes from the `features` presets (`canvas/SceneCanvas/features.ts`), each of which turns on
 * its own actions, tools, ambient bindings, and chrome.
 *
 * A consumer needing custom tools can pass `tools={useTools(...)}` and SceneCanvas forwards it
 * as-is — the internal tool registry is ignored in that case.
 */
import { getActiveModeFor } from '@weasel-js/modes';
import { useLatest } from '@weasel-js/react';
import { InputScope, useActionsRegistry } from '@weasel-js/routing/react';
import type { NodeId, Scene } from 'core/scene/types';
import { useCanvasCamera } from './SceneCanvas/useCanvasCamera';
import { useHeldModifiers } from './SceneCanvas/useHeldModifiers';
import { useCanvasIngestion } from 'features/ingestion/useCanvasIngestion';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type React from 'react';
import { forwardRef, useEffect, useMemo, useRef } from 'react';
import { DeviceProfileProvider, useDeviceProfile } from '../core/device/useDeviceProfile';
import { Canvas } from './Canvas';
import { canvasDebug, DevHuds } from './SceneCanvas/DevHuds';
import { CanvasKitProviders } from './SceneCanvas/CanvasKitProviders';
import { canvasPassThrough } from './SceneCanvas/canvasPassThrough';
import { SceneCanvasInput, type SceneCanvasInputOptions } from './SceneCanvas/SceneCanvasInput';
import type { PresetSource } from './SceneCanvas/features';
import { CORE_PRESET_SOURCE } from './SceneCanvas/namedPresets';
import type { BridgeAdapter, SceneCanvasProps } from './SceneCanvas/props';
import { useBakedScene } from './SceneCanvas/useBakedScene';
import { useCanvasDispatcher } from './SceneCanvas/useCanvasDispatcher';
import { publishPreviews } from './publishPreviews';
import { useCanvasSelection } from './SceneCanvas/useCanvasSelection';
import { useEnabledFeatures } from './SceneCanvas/useCanvasTools';
import { contributionEntries } from './SceneCanvas/useContributionRoles';
import { SurfaceDeclarations } from './SceneCanvas/SurfaceDeclarations';
import { useAddedViews, useSceneCanvasHandle } from './SceneCanvas/useSceneCanvasHandle';
import { useSceneCanvasLayers } from './SceneCanvas/useSceneCanvasLayers';
import { useSceneCanvasPathEdit } from './SceneCanvas/useSceneCanvasPathEdit';
import { useSceneCanvasTools, type SceneCanvasToolProps } from './SceneCanvas/useSceneCanvasTools';
import { useSceneCanvasChrome } from './SceneCanvas/useSceneChrome';
import { useDevtoolsOverride } from '../devtools/useDevtoolsRoot';
import { useSceneRedrawSources } from './SceneCanvas/useSceneRedrawSources';
import { useScenePicking } from './SceneCanvas/useScenePicking';
import { useGroupEntryContribution } from 'tools/builtin/select/groupEntry';
import { useNodeKinds } from './SceneCanvas/useNodeKinds';
import { useSurfaceViewInputs } from './SceneCanvas/useSurfaceViewInputs';
import type { CanvasExtensionApi, SceneCanvasApi } from './canvasExtension';
import { ViewRegistryProvider } from './viewRegistry';
import { chromeColorOf, watchThemeOf } from './accentColor';
import { ENTERED_FRAME_COLOR, ENTERED_FRAME_TOKEN } from 'features/selection/enteredGroupFrame';
export { SCENE_CANVAS_FEATURES, type Feature } from './SceneCanvas/features';
export type { BuiltinToolOptions } from './SceneCanvas/useBuiltinShapeTools';
export { defaultDrawOne } from './defaultDrawOne';
export { rotateAroundAABBCenter } from './poseRotation';

function SceneCanvasInner<TData, TLayer extends string, TPose>(
  props: SceneCanvasProps<TData, TLayer, TPose> & { presetSource: PresetSource },
  ref: React.ForwardedRef<SceneCanvasApi>,
) {
  const { selectTool: selectToolOpts, selectable = true, viewport, modes } = props;
  const devtools = useDevtoolsOverride(props.debug), { debug } = devtools;
  const descriptor = (props.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;
  const deviceProfile = useDeviceProfile();
  const scene = useBakedScene(props.scene);
  const getActiveMode = useMemo(() => (modes ? getActiveModeFor(modes) : undefined), [modes]);
  const heldModifiers = useHeldModifiers();

  // Our own refs, so input listeners attach even when the consumer forwards its own ref.
  const internalCanvasRef = useRef<HTMLElement | null>(null);
  const canvasApiRef = useRef<CanvasExtensionApi | null>(null);
  const declaredSize = useLatest({ width: props.width ?? 0, height: props.height ?? 0 });
  const { viewState, viewAnimation, camera } = useCanvasCamera({
    view: props.view, defaultView: props.defaultView, onViewChange: props.onViewChange, viewBounds: props.viewBounds,
    dims: () => canvasApiRef.current?.getSurfaceRect() ?? declaredSize.current,
    requestRedraw: () => { canvasApiRef.current?.requestRedraw(); },
  });
  const { viewRef } = viewState;
  const kinds = useNodeKinds(scene, props.routing);
  const selection = useCanvasSelection({ scene, props, selectable, kindOf: kinds.kindOf });
  const enabled = useEnabledFeatures(
    props.features, props.presetSource.named, viewport !== undefined, selectToolOpts?.rotate !== false,
  );
  const { pathEditState, selectToolWithDefaults } = useSceneCanvasPathEdit({
    host: props.pathEdit, opening: props.defaultPathEdit, getActiveMode, scene, selection,
    extensions: enabled.pathEdit, selectTool: selectToolOpts,
  });
  const picking = useScenePicking({ scene, selection, descriptor, props, viewRef, selectTool: selectToolWithDefaults, kinds });
  const { adapter, boundsOf, planeOfNode } = picking;
  const getNodeAtPointRef = useLatest(picking.getNodeAtPoint);
  const groupEntry = useGroupEntryContribution({ pickHit: picking.pickBest, tree: adapter, boxOf: boundsOf });
  const tools = useSceneCanvasTools({
    props: props as SceneCanvasToolProps, select: picking.selectTool, move: picking.moveOptions,
    enabled, presetSource: props.presetSource, groupEntry,
  });

  // The wrapper's `<InputScope>` provides it.
  const actionsRegistry = useActionsRegistry();
  const { dispatcher, gestureSource, previewIdsExtra, previewPoseExtra } = useCanvasDispatcher(actionsRegistry);
  useEffect(() => publishPreviews(scene, dispatcher), [scene, dispatcher]);

  const frameColor = useMemo(() => ({
    read: () => chromeColorOf(internalCanvasRef.current, ENTERED_FRAME_TOKEN, ENTERED_FRAME_COLOR),
    changed: (fn: () => void) => watchThemeOf(() => internalCanvasRef.current, fn),
  }), []);
  const layered = useSceneCanvasLayers({
    layers: props.layers, targetScale: deviceProfile.targetScale, scene, adapter, poseDescriptor: descriptor,
    enteredGroup: picking.enteredGroup, frameColor, alphaFor: props.alphaFor, colorOverrides: props.animator?.colorOverrides, boundsOf, planeOfNode,
    poseTransition: props.poseTransition, previewIds: previewIdsExtra, dispatcher, snapReadout: props.snap?.readout !== false, snapReadoutStyle: props.snap?.readoutStyle, pathEditState,
    slops: debug !== undefined && debug !== false && debug.slops === true,
    boundsIncludeStroke: props.geometry?.boundsIncludeStroke ?? true, selectTool: selectToolOpts,
  });
  const redrawOn = useSceneRedrawSources({ props, scene, heldModifiers, departures: layered.departures });

  const chrome = useSceneCanvasChrome({
    source: {
      getMode: getActiveMode, getFocused: props.getFocused, getModifiers: heldModifiers.get,
      resizable: selectToolOpts?.resize?.resizable,
      editingAnchors: () => pathEditState.getEditingId() !== '',
      device: deviceProfile,
    },
    rules: { enabled, selectable, chromeVisibility: props.chromeVisibility },
    hover: { canvasApiRef, nodeAtPointRef: getNodeAtPointRef, ...(props.onHover ? { onChange: props.onHover } : {}) },
    selection: selection.current as readonly NodeId[], viewRef, dispatcher,
  });

  const { ingest, clipboard: ingestionClipboard } = useCanvasIngestion(adapter, () => actionsRegistry, props.ingestion);
  const { views: addedViews, addView, viewAt, aimOf, setAim } = useAddedViews();
  // The consumer's handle extends the primitive's with `ingest`, which needs the action stack.
  const { handleRef, ready: canvasReady } = useSceneCanvasHandle({
    ref, elementRef: internalCanvasRef, apiRef: canvasApiRef, onElement: chrome.trackHoverOn,
    ingest, viewAnimation, camera, addView, viewAt, aimOf, setAim,
  });
  const viewInputs = useSurfaceViewInputs({ picking, selection, resizeHandles: layered.resizeHandles,
    descriptor: descriptor as PoseDescriptor<unknown>, chromeCaps: chrome.chromeCaps, rotationBadge: layered.rotationBadge,
  });

  return (
    <CanvasKitProviders viewInputs={viewInputs}>
      <Canvas<TPose>
        ref={handleRef} adapter={adapter} selection={selection} poseDescriptor={descriptor}
        tools={tools.tools} layers={layered.layers}
        // The chrome's bounds are the picker's: a node on a parallax plane is
        // boxed where the plane draws it, and a `geometry.boundsOf` reaches both.
        boundsOf={boundsOf} boundsOfPose={picking.boundsOfPose}
        getIsVisible={chrome.getIsVisible}
        // The gesture surface behind `helpersRef.getGestureBounds()` /
        // `subscribeGestures()` — Canvas has no dispatcher of its own.
        gestureSource={gestureSource}
        previewPoseExtra={previewPoseExtra}
        {...(debug !== undefined ? { debug: canvasDebug(debug) } : {})}
        contentVersion={scene.getVersion} layerVisibility={props.layerVisibility} layerOrder={props.layerOrder}
        viewState={viewState} redrawOn={redrawOn}
        {...canvasPassThrough(props)}
      />
      <DevHuds
        cursorCoords={props.cursorCoordsHud} pick={props.pickHud} modality={props.modalityHud}
        canvasRef={internalCanvasRef} canvasApiRef={canvasApiRef}
        detachedInput={props.paintInto ? props.inputElement ?? null : undefined}
        viewRef={viewRef} pickEvery={picking.pickEvery} pickBest={picking.pickBest}
      />
      <SceneCanvasInput
        props={props as SceneCanvasInputOptions} scene={scene as Scene<unknown, string, unknown>}
        selection={selection} descriptor={descriptor as PoseDescriptor<unknown>}
        picking={{ ...picking, adapter: adapter as unknown as BridgeAdapter }} nodeAtPointRef={getNodeAtPointRef}
        tools={tools} viewOn={enabled.has('view')} camera={{ viewState, viewAnimation }}
        dispatcher={dispatcher} pathEdit={{ state: pathEditState }}
        chrome={chrome} overlay={layered} ingestionClipboard={ingestionClipboard} devtools={devtools}
        canvas={{ elementRef: internalCanvasRef, apiRef: canvasApiRef, ready: canvasReady }} snapSources={enabled.snapSources} snapStore={layered.snapStore}
      />
      <SurfaceDeclarations views={props.views} entries={contributionEntries(tools.tools)} added={addedViews} />
      {props.children}
    </CanvasKitProviders>
  );
}

const SceneCanvasInnerForwardRef = forwardRef(SceneCanvasInner);

// The canvas's input scope sits above `SceneCanvasInner`, whose own hooks
// (`useTools` among them) must already read this canvas's tool and registries.
// Its device profile too, so the canvas and everything under it share one.
/** A scene canvas resolving its `features` through `source`. */
export function renderSceneCanvas<TData, TLayer extends string, TPose>(
  source: PresetSource,
  { device, ...props }: SceneCanvasProps<TData, TLayer, TPose>,
  ref: React.ForwardedRef<SceneCanvasApi>,
) {
  return (
    <InputScope yoke={props.yoke}>
      <DeviceProfileProvider value={device}>
        <ViewRegistryProvider>
          <SceneCanvasInnerForwardRef {...(props as SceneCanvasProps<unknown, string, unknown>)} presetSource={source} ref={ref} />
        </ViewRegistryProvider>
      </DeviceProfileProvider>
    </InputScope>
  );
}

function SceneCanvasWrapper<TData, TLayer extends string, TPose>(
  props: SceneCanvasProps<TData, TLayer, TPose>, ref: React.ForwardedRef<SceneCanvasApi>,
) {
  return renderSceneCanvas(CORE_PRESET_SOURCE, props, ref);
}

// Marked pure so a bundle using only `LeanSceneCanvas` drops it, and core's named presets with it.
/**
 * The canvas component: renders a `Scene` and wires the interaction stack
 * around it.
 *
 * Mounted bare it renders the scene, keeps a selection no input sets, and
 * runs a gesture dispatcher for whatever bindings the consumer adds. The
 * `features` presets turn the kit's behavior on — `features={['draw']}` is the
 * whole editor: tools, standard actions and their keys, selection chrome,
 * undo. This is the intended entry point; the lower-level primitives it
 * composes are not part of the public surface.
 *
 * Its ref exposes a `SceneCanvasApi` for the imperative operations that do not
 * fit a prop (view control, hit queries, redraw requests).
 */
export const SceneCanvas = /* @__PURE__ */ forwardRef(SceneCanvasWrapper) as <
  TData, TLayer extends string, TPose,
>(
  props: SceneCanvasProps<TData, TLayer, TPose> & { ref?: React.Ref<SceneCanvasApi> },
) => ReturnType<typeof SceneCanvasInner>;

export { DEFAULT_HANDLE_SIZE, BUILTIN_TOOL_IDS } from './SceneCanvas/props';
export {
  BUILTIN_TOOLS, BUILTIN_TOOL_GROUPS, TOOL_GROUP_ORDER,
  SELECT_TOOLS, VIEW_TOOLS, SHAPE_TOOLS, DRAW_TOOLS, TYPE_TOOLS, PAGE_TOOLS,
} from './SceneCanvas/builtinToolSets';
export { mergeLayersWithDefaults } from './SceneCanvas/mergeLayers';
export type {
  SceneCanvasProps, SceneCanvasHit, SceneCanvasLayers, SceneCanvasLongPress, BuiltinToolId,
} from './SceneCanvas/props';
export type { CoordTraceEntry } from './SceneCanvas/coordTrace';
