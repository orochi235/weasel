/**
 * `<SceneCanvas>` — `<Canvas>` wired to a `Scene` primitive.
 *
 * Synthesizes a `MoveAdapter & ResizeAdapter & RotateAdapter & AreaSelectAdapter`
 * from the passed `scene` (via `sceneToAdapter`) and constructs an internal
 * `useSelectTool` + `useTools` so consumers don't have to. The caller-facing
 * API still accepts `pickEvery`/`boundsOf`/`handleHitRadius`/`snap`/
 * `moveOptions`/`resizeOptions`/`rotateOptions`/`selectionOptions` — those
 * props are folded into the internal tool rather than forwarded to Canvas.
 *
 * If a consumer needs custom tools (e.g. `select` + `insert`), they can pass
 * `tools={useTools(...)}` directly and SceneCanvas forwards it as-is — the
 * internal default tool is ignored in that case.
 *
 * Cascade defaults: Scene v1 stores absolute poses, so dragging a container
 * needs (a) the live overlay to translate descendants and (b) commit-time
 * setPose to translate descendants too. SceneCanvas wires both by default
 * from `scene` knowledge (children-of-id + absolute pose lookup); consumers
 * can override either by passing their own `moveOptions.cascadeWorldPose`.
 */
import { forwardRef, useCallback, useMemo, useRef } from 'react';
import type React from 'react';
import type { ReactNode } from 'react';
import { type ActionsProp } from 'interactions/actions/registry';
import { useStandardActions } from 'interactions/actions/useStandardActions';
import { translateRectPose } from 'features/groups/composePose';
import type { DrawCommand, ShaderProgramHandle } from '../renderer';
import type { Paint } from 'core/paint-types';
import type { RenderLayer } from 'core/layers/render';
import { Canvas } from './Canvas';
import type { CanvasProps, LayersMap } from './Canvas';
import type { CanvasExtensionApi } from './canvasExtension';
import type { SceneToAdapterOptions } from './sceneAdapter';
import type { PanBounds } from 'core/viewport/useDecayLoop';
import type { View } from 'core/viewport/view';
import type { Node, Scene } from 'core/scene/types';
import type { NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { useSelection, type SelectionApi, type UseSelectionOptions } from 'core/selection/useSelection';
import { usePublishSelection } from 'features/selection/SelectionContext';
import type { Bounds } from 'tools/builtin/useSelectTool';
import { useTools, type ToolsApi } from 'tools/useTools';
import { useKeybindings } from 'tools/useKeybindings';
import type { AnyTool } from 'tools/types';
import type { UseMoveOptions } from 'interactions/gestures/move/move';
import type { UseResizeOptions } from 'interactions/gestures/resize/resize';
import type { UseRotateOptions } from 'interactions/gestures/rotate/rotate';
import type { SnapStrategy } from 'interactions/gestures/types';
import type { UseAreaSelectOptions } from 'interactions/gestures/area-select/areaSelect';
import { ActionsProviderIfRoot } from './SceneCanvas/ActionsProviderIfRoot';
import { useSceneSelectTool } from './SceneCanvas/useSceneSelectTool';
import { useViewportTools } from './SceneCanvas/useViewportTools';
import { usePreviewGhostLayer } from './SceneCanvas/usePreviewGhostLayer';
import type { StandardActionsDeps, StandardActionDefaults } from 'interactions/actions/resolveActions';

/** Default size in CSS pixels for selection corner-handles AND their
 *  hit-test radius. Used by the SceneCanvas defaults; consumers override
 *  via `selectTool.handleHitRadius` or `layers.selectionOverlay.handles.size`. */
export const DEFAULT_HANDLE_SIZE = 8;

/** Default scene-slot `drawOne`. Paints each node as a filled rect using
 *  `node.data.color` if present, falling back to neutral gray. Assumes
 *  TPose carries `{ x, y, width, height }` — consumers with non-rect
 *  poses (paths, polygons) must supply their own `drawOne`. */
export function defaultDrawOne<TData, TLayer extends string, TPose>(
  node: Node<TData, TLayer, TPose>,
  pose: TPose,
): DrawCommand[] {
  const p = pose as unknown as { x: number; y: number; width: number; height: number };
  const color = (node.data as { color?: string } | null)?.color ?? '#888';
  return [{
    kind: 'path',
    path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
    fill: { color },
  }];
}

/** Deep-merge user-supplied `layers` with kit defaults. Slots the user
 *  doesn't mention get filled with defaults; slots explicitly set to
 *  `null` are dropped (the existing "disable this slot" convention).
 *  Partial slot configs (e.g. `{ scene: { drawOne: customFn } }`) are
 *  shallow-spread on top of the default slot config. */
export function mergeLayersWithDefaults<TData, TLayer extends string, TPose>(
  user: LayersMap<Node<TData, TLayer, TPose>, TPose> | undefined,
): LayersMap<Node<TData, TLayer, TPose>, TPose> {
  const defaults = {
    scene: { drawOne: defaultDrawOne as (
      node: Node<TData, TLayer, TPose>,
      pose: TPose,
    ) => DrawCommand[] },
    selectionOverlay: { handles: { size: DEFAULT_HANDLE_SIZE } },
  };

  if (!user) return defaults as LayersMap<Node<TData, TLayer, TPose>, TPose>;

  // Start from a shallow copy of the user map so unknown slots pass through.
  const result: LayersMap<Node<TData, TLayer, TPose>, TPose> = { ...user };

  if (!('scene' in user)) {
    result.scene = defaults.scene;
  } else if (user.scene === null) {
    result.scene = null;
  } else {
    result.scene = { ...defaults.scene, ...user.scene };
  }

  if (!('selectionOverlay' in user)) {
    result.selectionOverlay = defaults.selectionOverlay;
  } else if (user.selectionOverlay === null) {
    result.selectionOverlay = null;
  } else {
    result.selectionOverlay = { ...defaults.selectionOverlay, ...user.selectionOverlay };
  }

  return result;
}

/** Built-in tool ids SceneCanvas knows how to mount when no `tools` prop
 *  is supplied. Pass a subset via `defaultTools` to slim the registered set. */
export type BuiltinToolId = 'select' | 'resize' | 'rotate' | 'hand';

export type SceneCanvasProps<TData, TLayer extends string, TPose> =
  Omit<
    CanvasProps<Node<TData, TLayer, TPose>, TPose>,
    | 'adapter' | 'items' | 'setItems' | 'toPose' | 'fromPose'
    | 'createDefault' | 'poseBounds' | 'intersectsRect'
    | 'moveOptions' | 'resizeOptions' | 'rotateOptions'
    | 'snap' | 'pickEvery' | 'boundsOf' | 'handleHitRadius'
    | 'selection' | 'selectionOptions' | 'tools' | 'geometry'
    | 'layers'   // stripped so we can re-add as optional below
  >
  & {
    scene: Scene<TData, TLayer, TPose>;

    /** Layer configuration. When omitted, SceneCanvas applies kit defaults
     *  (a scene slot that paints `node.data.color` rects + a default
     *  selection overlay). Partial slot configs deep-merge with the
     *  defaults; pass `slot: null` to suppress a default explicitly. */
    layers?: LayersMap<Node<TData, TLayer, TPose>, TPose>;

    /** Layout strategies keyed by container node id (or a resolver). Forwarded
     *  to `sceneToAdapter` so `useMove`'s layout pass runs on configured
     *  containers (reflow on enter, reparent + reflow on commit). */
    layouts?: SceneToAdapterOptions<TData, TLayer, TPose>['layouts'];

    // --- Geometry: hit-test + bounds overrides consumed by the internal
    //     `useSelectTool`. Ignored if the consumer passes their own `tools`. ---
    geometry?: {
      pickEvery?: (worldX: number, worldY: number) => string | null;
      boundsOf?: (id: string) => Bounds | null;
    };

    // --- Select tool options. Ignored if the consumer passes their own
    //     `tools` prop. ---
    selectTool?: {
      move?: UseMoveOptions<TPose>;
      resize?: UseResizeOptions<TPose>;
      rotate?: UseRotateOptions<TPose>;
      snap?: SnapStrategy<TPose>;
      handleHitRadius?: number;
      /** Marquee area-select. Default: no behaviors (a drag from empty space
       *  doesn't mutate the selection). Pass
       *  `{ behaviors: [selectFromMarquee()] }` to enable rubber-band select. */
      areaSelect?: UseAreaSelectOptions;
    };

    // --- Insert tool: when `create` is supplied, the synthesized adapter
    //     exposes `commitInsert` and inserted objects are added as leaves on
    //     `layer` (default `'default'`). ---
    insertTool?: {
      create: SceneToAdapterOptions<TData, TLayer, TPose>['commitInsert'];
      layer?: TLayer;
    };

    // --- Selection ---
    selection?: SelectionApi;
    selectionOptions?: UseSelectionOptions;

    // --- Tool dispatcher escape hatch ---
    /** Custom tool registry. When supplied, the internal default
     *  `useSelectTool` is bypassed and this `tools` value is forwarded to
     *  Canvas as-is. Consumers needing extra tools (insert, etc.) take this
     *  path. */
    tools?: ToolsApi;

    /**
     * Which built-in tools SceneCanvas registers in its internal `useTools`.
     * Default: `['select', 'resize', 'rotate']` (plus `'hand'` when the
     * `viewport` feature is on). Pass a smaller array to slim — e.g.
     * `['select']` for move-only. Ignored when the consumer supplies their
     * own `tools` prop (the escape hatch path).
     */
    defaultTools?: readonly BuiltinToolId[];

    /** Always-on tools to register alongside the internal default select.
     *  Use this for wheel/keyboard zoom + pan tools that should run alongside
     *  the default select. If you supply your own `tools` prop, this is
     *  ignored — wire `ambient` through your own `useTools` call instead. */
    ambient?: AnyTool[];

    /** Viewport feature wiring. Each sub-key opts a feature in; pass `true`
     *  for defaults or an object to tune. When omitted, no viewport tools
     *  (hand, keyboard zoom, pinch) are registered by SceneCanvas. */
    viewport?: {
      inertia?: boolean | { friction?: number; minSpeed?: number; boundary?: 'stop' | 'bounce' | 'spring'; bounds?: PanBounds };
      pinchZoom?: boolean | { min?: number; max?: number };
      animatedZoom?: boolean | { duration?: number; resetDuration?: number; easing?: (t: number) => number };
    };

    /**
     * @experimental
     * Override / disable / extend the default action set. Resolution rules:
     * see `docs/superpowers/specs/2026-05-09-actions-registry-design.md` §D.
     * Pass `null` to disable all defaults.
     */
    actions?: ActionsProp;

    /**
     * @experimental
     * Inputs the kit can't synthesize on its own — currently `cloneNode`
     * for the `duplicate` default. When omitted, the `duplicate` default is
     * silently dropped from the registered set.
     */
    actionDefaults?: {
      cloneNode?: (id: NodeId, offset: { dx: number; dy: number }) => { id: NodeId };
      /** Per-clone offset for the duplicate default. Default {dx:8,dy:8}. */
      duplicateOffset?: { dx: number; dy: number };
      /** Base nudge step. Default 1. */
      nudgeStep?: number;
      /** Shifted nudge step. Default 10. */
      nudgeShiftStep?: number;
    };

    /**
     * @experimental
     * Optional resolver: given a scene node, return a short human-readable
     * "kind" label (e.g. `'rectangle'`, `'path'`, `'sticky note'`). When
     * supplied, the kit publishes per-id kinds into any surrounding
     * `<SelectionContextProvider>` so non-canvas UI (palette, status bar)
     * can render type-aware copy. Return `undefined` to skip an entry.
     *
     * Default behavior when omitted: containers report `'group'`, paths
     * (poses with a `kind` property) report `'path'`, everything else is
     * left unlabelled.
     */
    describeKind?: (node: Node<TData, TLayer, TPose>) => string | undefined;

    /**
     * Children rendered alongside the canvas. Useful for siblings that need
     * the same `<ActionsProvider>` scope (e.g. shortcuts overlays, probes).
     */
    children?: ReactNode;

    /**
     * Custom shader programs to compile on the renderer. Forwarded directly
     * to `<Canvas shaders={...} />`. See `CanvasProps.shaders` for details.
     */
    shaders?: ShaderProgramHandle[];

    /**
     * Paint applied to the full canvas behind the scene. Accepts the kit's
     * `Paint` union (solid / pattern / linear-gradient / radial-gradient /
     * conic-gradient) so consumers don't have to author a background node
     * just to colorize the canvas. Rendered as a screen-space layer slotted
     * before `'scene'` — independent of pan / zoom.
     */
    backgroundFill?: Paint;
  };

function SceneCanvasInner<TData, TLayer extends string, TPose>(
  props: SceneCanvasProps<TData, TLayer, TPose>,
  ref: React.ForwardedRef<CanvasExtensionApi>,
) {
  const {
    scene,
    gestures,
    geometry,
    selectTool: selectToolOpts,
    insertTool,
    layouts,
    selection: selectionProp,
    selectionOptions,
    tools: toolsProp,
    defaultTools,
    ambient,
    viewport,
    layers,
    actions,
    actionDefaults,
    describeKind,
    children,
    shaders,
    backgroundFill,
    ...rest
  } = props;

  // Extract view-related props from rest so we can intercept them for the
  // pinch-zoom hook (which needs the current view) without breaking the
  // controlled/uncontrolled pattern Canvas exposes.
  const { view: viewProp, onViewChange: onViewChangeProp, defaultView, ...restProps } = rest;

  // Internal canvas ref so usePinchZoomTool can attach pointer listeners
  // even when the consumer passes their own forwarded ref.
  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Stable ref tracking the latest view for usePinchZoomTool.
  // Updated synchronously on incoming controlled-prop renders AND via
  // pinchSetView so the pinch gesture always sees the latest view.
  const currentViewRef = useRef<View>(viewProp ?? defaultView ?? { x: 0, y: 0, scale: 1 });
  if (viewProp !== undefined) currentViewRef.current = viewProp;

  // Single setView callback used both by the pinch tool and as Canvas's
  // `onViewChange` — keeps `currentViewRef` in sync (for the uncontrolled-view
  // path where Canvas owns the state) and forwards to the consumer.
  const handleViewChange = useCallback((v: View) => {
    currentViewRef.current = v;
    onViewChangeProp?.(v);
  }, [onViewChangeProp]);

  // Selection: caller-supplied wins; otherwise build from selectionOptions.
  // Hooks always run unconditionally — when a caller supplies `selection`,
  // the internally-built one is unused but the hook still fires.
  const internalSelection = useSelection(selectionOptions ?? {});
  const selection = selectionProp ?? internalSelection;

  // Publish the current selection (with optional per-id kind labels) into any
  // surrounding `<SelectionContextProvider>` so non-canvas UI can read it.
  // No-op when no provider is in scope.
  const selectionKinds = useMemo<readonly (string | undefined)[] | undefined>(() => {
    if (selection.current.length === 0) return undefined;
    const out: (string | undefined)[] = [];
    for (const id of selection.current) {
      const node = scene.get(id);
      if (!node) { out.push(undefined); continue; }
      if (describeKind) { out.push(describeKind(node)); continue; }
      // Default heuristic: containers -> 'group', poses with .kind -> 'path',
      // everything else unlabelled (consumer can supply describeKind to fill in).
      if (node.kind === 'container') { out.push('group'); continue; }
      const pose = node.pose as unknown as { kind?: unknown } | null;
      if (pose && typeof pose === 'object' && 'kind' in pose && typeof pose.kind === 'string') {
        out.push('path');
        continue;
      }
      out.push(undefined);
    }
    return out;
  }, [selection.current, scene, describeKind]);
  usePublishSelection(selection.current, selectionKinds);

  // Adapter + select tool — folded into a single hook that synthesizes both.
  // Apply the DEFAULT_HANDLE_SIZE fallback here so useSceneSelectTool always
  // receives a concrete radius even when the caller omits selectTool entirely.
  const selectToolWithDefaults = useMemo(() => ({
    handleHitRadius: DEFAULT_HANDLE_SIZE,
    ...selectToolOpts,
  }), [selectToolOpts]);

  const { adapter, selectTool: internalSelect, resizeTool, rotateTool, pickEvery: internalPickEvery } = useSceneSelectTool({
    scene,
    selection,
    geometry,
    selectTool: selectToolWithDefaults,
    ...(insertTool ? { insertTool } : {}),
    ...(layouts ? { layouts } : {}),
  });

  // Viewport tools (hand / keyboard zoom / wheel zoom / pinch zoom). All
  // hooks run unconditionally; each is a no-op when its config is absent.
  const { handTool, keyZoomTool, wheelZoomTool, viewportRegistered } = useViewportTools({
    viewport,
    canvasRef: internalCanvasRef,
    currentView: currentViewRef.current,
    onViewChange: handleViewChange,
  });

  // keyZoom and wheelZoom are always-on (ambient); handTool must be in the
  // registry so H keybinding and space hotkey work via useKeybindings.
  const viewportAmbient: AnyTool[] = viewportRegistered
    ? [keyZoomTool, wheelZoomTool]
    : [];

  // Resolve which built-ins to mount. When the consumer omits `defaultTools`,
  // preserve previous behavior: all three pointer tools (select/resize/rotate)
  // plus `hand` when the viewport feature is engaged.
  const requestedTools: readonly BuiltinToolId[] = defaultTools ?? (
    viewportRegistered
      ? ['select', 'resize', 'rotate', 'hand']
      : ['select', 'resize', 'rotate']
  );
  const wants = (id: BuiltinToolId): boolean => requestedTools.includes(id);

  // WHY ambient (not registry) for resize+rotate: `useTools.getActiveOverlays()`
  // returns only active + hotkey + ambient overlays. The Canvas affordance
  // pipeline (`__setHitTestContext`) walks those exclusively, so a registry
  // entry that is neither active nor ambient would never have its hitTest
  // routed. Resize and rotate are affordance-driven (no foreground activation,
  // no hotkey), so ambient is the correct slot.
  const builtinAmbient: AnyTool[] = [];
  if (wants('resize')) builtinAmbient.push(resizeTool);
  if (wants('rotate')) builtinAmbient.push(rotateTool);

  const mergedAmbient = [...viewportAmbient, ...builtinAmbient, ...(ambient ?? [])];

  const internalRegistry: Record<string, AnyTool> = {};
  if (wants('select')) internalRegistry.select = internalSelect;
  // `hand` stays in the registry (not ambient) so its H keybinding + space
  // hotkey route through `useKeybindings`. The `viewportRegistered` guard
  // ensures a consumer who passes `defaultTools: ['select','hand']` without
  // enabling the viewport feature still gets a clean registry (no hand entry).
  if (wants('hand') && viewportRegistered) internalRegistry.hand = handTool;

  const internalTools = useTools({
    active: 'select',
    registry: internalRegistry,
    ...(mergedAmbient.length ? { ambient: mergedAmbient } : {}),
  });

  useKeybindings(internalTools, { disable: !!toolsProp });

  const tools = toolsProp ?? internalTools;

  const wiredGestures = { undoRedo: { adapter: scene }, ...gestures };

  // Merge caller-supplied layers with kit defaults. When `layers` is omitted
  // the result is the full default set (scene + selectionOverlay). Partial
  // configs deep-merge; `null` slot values suppress a default explicitly.
  const mergedLayers = useMemo(
    () => mergeLayersWithDefaults(layers),
    [layers],
  );

  // Preview-ghost layer: renders in-flight gesture poses on top of the
  // committed scene using the scene slot's `drawOne`.
  const previewLayer = usePreviewGhostLayer<TData, TLayer, TPose>({
    scene,
    tools,
    sceneSlot: mergedLayers.scene,
  });

  // Background-fill layer: screen-space, emits a single full-canvas rect
  // with the configured `Paint`. Slotted before `'scene'` so the scene
  // draws on top. Independent of pan / zoom because backgrounds in this
  // kit are canvas chrome, not world content — consumers that want a
  // world-space backdrop add their own scene node.
  const backgroundLayer = useMemo<RenderLayer<unknown> | null>(() => {
    if (!backgroundFill) return null;
    return {
      id: 'scene-background-fill',
      label: 'Background fill',
      space: 'screen',
      draw: (_data, _view, dims) => [{
        kind: 'path',
        path: { kind: 'rect', x: 0, y: 0, width: dims.width, height: dims.height },
        fill: backgroundFill,
      }],
    };
  }, [backgroundFill]);

  const wiredLayers = useMemo<LayersMap<Node<TData, TLayer, TPose>, TPose>>(() => ({
    ...mergedLayers,
    previewGhost: { layer: previewLayer, after: 'scene' },
    ...(backgroundLayer ? { backgroundFill: { layer: backgroundLayer, before: 'scene' } } : {}),
  }), [mergedLayers, previewLayer, backgroundLayer]);

  // Standard-action deps: closures over the live scene / selection / adapter
  // so the resolved actions always read current state. `useStandardActions`
  // stabilizes via refs internally — these closures are passed every render
  // but the registered Action descriptors are not re-registered.
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const standardActionsDeps = useMemo<StandardActionsDeps<TPose>>(() => ({
    setSelection: (ids) => selectionRef.current.adapterMethods.setSelection(ids),
    getSelection: () => [...selectionRef.current.current],
    listAll: () => {
      const out: NodeId[] = [];
      for (const nid of sceneRef.current.renderOrder()) out.push(nid);
      return out;
    },
    getPose: (id) => {
      const n = sceneRef.current.get(id);
      return n?.pose as TPose;
    },
    applyOps: (ops: Op[], label?: string) => {
      const a = adapterRef.current;
      if (typeof (a as { applyOps?: unknown }).applyOps === 'function') {
        (a as { applyOps: (ops: Op[], label: string) => void }).applyOps(ops, label ?? '');
      } else {
        for (const op of ops) op.apply(a);
      }
    },
    translatePose: (p, dx, dy) =>
      translateRectPose(
        p as unknown as { x: number; y: number; width: number; height: number },
        dx, dy,
      ) as unknown as TPose,
  }), []);

  // Merge the forwarded ref with our internalCanvasRef so usePinchZoomTool
  // can read the canvas element even when the consumer also forwards a ref.
  const mergedRef = useCallback(
    (node: CanvasExtensionApi | null) => {
      internalCanvasRef.current = node?.element ?? null;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<CanvasExtensionApi | null>).current = node;
    },
    [ref],
  );

  const canvas = (
    <Canvas<Node<TData, TLayer, TPose>, TPose>
      ref={mergedRef}
      adapter={adapter}
      gestures={wiredGestures}
      selection={selection}
      tools={tools}
      layers={wiredLayers}
      pickEvery={internalPickEvery}
      {...(viewProp !== undefined ? { view: viewProp } : {})}
      {...(defaultView !== undefined ? { defaultView } : {})}
      onViewChange={handleViewChange}
      shaders={shaders}
      {...restProps}
    />
  );

  return (
    <ActionsProviderIfRoot>
      {canvas}
      <StandardActionsRegistrar
        deps={standardActionsDeps}
        actions={actions}
        defaults={actionDefaults}
      />
      {children}
    </ActionsProviderIfRoot>
  );
}

/**
 * Registers the kit's default action set into whatever `<ActionsProvider>`
 * is in scope. Lives inside `<ActionsProviderIfRoot>` so it sees both
 * parent-supplied registries and SceneCanvas's auto-mounted one.
 */
function StandardActionsRegistrar<TPose>({
  deps, actions, defaults,
}: {
  deps: StandardActionsDeps<TPose>;
  actions: ActionsProp | undefined;
  defaults: StandardActionDefaults<TPose> | undefined;
}) {
  useStandardActions(deps, {
    ...(actions !== undefined ? { actions } : {}),
    ...(defaults !== undefined ? { defaults } : {}),
  });
  return null;
}

export const SceneCanvas = forwardRef(SceneCanvasInner) as <
  TData, TLayer extends string, TPose,
>(
  props: SceneCanvasProps<TData, TLayer, TPose> & { ref?: React.Ref<CanvasExtensionApi> },
) => ReturnType<typeof SceneCanvasInner>;
