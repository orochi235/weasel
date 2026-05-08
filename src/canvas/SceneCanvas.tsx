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
import { Canvas } from './Canvas';
import type { CanvasProps, LayersMap } from './Canvas';
import type { RenderLayer } from '../core/layers/render';
import { sceneToAdapter, type SceneToAdapterOptions } from './sceneAdapter';
import { usePinchZoomTool } from '../tools/builtin/usePinchZoomTool';
import type { PanBounds } from '../features/viewport/useDecayLoop';
import { useHandTool } from '../tools/builtin/useHandTool';
import { useKeyboardZoomTool } from '../tools/builtin/useKeyboardZoomTool';
import { useWheelZoomTool } from '../tools/builtin/useWheelZoomTool';
import type { View } from '../features/viewport/view';
import type { Node, Scene } from '../core/scene/types';
import { asNodeId } from '../core/scene/types';
import type { Op } from '../core/ops/types';
import { useSelection, type SelectionApi, type UseSelectionOptions } from '../features/selection/useSelection';
import { useSelectTool, type Bounds } from '../tools/builtin/useSelectTool';
import { useTools, type ToolsApi } from '../tools/useTools';
import { useKeybindings } from '../tools/useKeybindings';
import type { AnyTool } from '../tools/types';
import type { UseMoveOptions } from '../interactions/gestures/move/move';
import type { UseResizeOptions } from '../interactions/gestures/resize/resize';
import type { UseRotateOptions } from '../interactions/gestures/rotate/rotate';
import type { SnapStrategy } from '../interactions/gestures/types';
import { snap as snapBehavior } from '../interactions/gestures/shared/snap';
import { RECT_POSE_DESCRIPTOR } from '../interactions/gestures/resize/geometry';
import { pathPoseDescriptor } from '../features/paths/poseDescriptor';
import type { Path } from '../features/paths/types';

// Bounds extraction mirrors Canvas's AUTO_POSE_DESCRIPTOR — picks the path
// descriptor for `{kind:'polygon'|'rect'}` poses and falls back to rect.
function isPathLike(p: unknown): p is Path {
  if (!p || typeof p !== 'object') return false;
  const k = (p as { kind?: unknown }).kind;
  return k === 'polygon' || k === 'rect';
}
function aabbOfPose<TPose>(pose: TPose): Bounds {
  if (isPathLike(pose)) return pathPoseDescriptor.getBounds(pose);
  return RECT_POSE_DESCRIPTOR.getBounds(pose as { x: number; y: number; width: number; height: number });
}
function poseContains<TPose>(pose: TPose, wx: number, wy: number): boolean {
  if (isPathLike(pose) && pathPoseDescriptor.intersectsRect) {
    return pathPoseDescriptor.intersectsRect(pose, { x: wx, y: wy, width: 0, height: 0 });
  }
  const b = aabbOfPose(pose);
  return wx >= b.x && wx <= b.x + b.width && wy >= b.y && wy <= b.y + b.height;
}

export type SceneCanvasProps<TData, TLayer extends string, TPose> =
  Omit<
    CanvasProps<Node<TData, TLayer, TPose>, TPose>,
    | 'adapter' | 'items' | 'setItems' | 'toPose' | 'fromPose'
    | 'createDefault' | 'poseBounds' | 'intersectsRect'
    | 'moveOptions' | 'resizeOptions' | 'rotateOptions'
    | 'snap' | 'pickEvery' | 'boundsOf' | 'handleHitRadius'
    | 'selection' | 'selectionOptions' | 'tools' | 'geometry'
  >
  & {
    scene: Scene<TData, TLayer, TPose>;
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

    /** Always-on tools to register alongside the internal default select.
     *  Use this for wheel/keyboard zoom + pan tools that should run alongside
     *  the default select. If you supply your own `tools` prop, this is
     *  ignored — wire `ambient` through your own `useTools` call instead. */
    ambient?: AnyTool[];

    /** Viewport feature wiring. Each sub-key opts a feature in; pass `true`
     *  for defaults or an object to tune. When omitted, no viewport tools
     *  (hand, keyboard zoom, pinch) are registered by SceneCanvas. */
    viewport?: {
      inertia?: boolean | { friction?: number; minSpeed?: number; boundary?: 'stop' | 'bounce'; bounds?: PanBounds };
      pinchZoom?: boolean | { min?: number; max?: number };
      animatedZoom?: boolean | { duration?: number; resetDuration?: number; easing?: (t: number) => number };
    };
  };

function SceneCanvasInner<TData, TLayer extends string, TPose>(
  props: SceneCanvasProps<TData, TLayer, TPose>,
  ref: React.ForwardedRef<HTMLCanvasElement>,
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
    ambient,
    viewport,
    layers,
    ...rest
  } = props;

  // Extract view-related props from rest so we can intercept them for the
  // pinch-zoom hook (which needs the current view) without breaking the
  // controlled/uncontrolled pattern Canvas exposes.
  const { view: viewProp, onViewChange: onViewChangeProp, defaultView, ...restProps } = rest;

  // Resolve viewport config — `true` means defaults, object means overrides,
  // anything else (undefined / false / null) disables that feature.
  const inertiaEnabled = !!viewport?.inertia;
  const inertiaObj = typeof viewport?.inertia === 'object' ? viewport.inertia : undefined;
  const inertiaFriction = inertiaObj?.friction;
  const inertiaMinSpeed = inertiaObj?.minSpeed;
  const inertiaBoundary = inertiaObj?.boundary;
  const inertiaBounds = inertiaObj?.bounds;
  const inertiaConfig = useMemo<false | { friction?: number; minSpeed?: number; boundary?: 'stop' | 'bounce'; bounds?: PanBounds }>(
    () => inertiaEnabled ? { friction: inertiaFriction, minSpeed: inertiaMinSpeed, boundary: inertiaBoundary, bounds: inertiaBounds } : false,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inertiaEnabled, inertiaFriction, inertiaMinSpeed, inertiaBoundary, inertiaBounds],
  );
  const pinchConfig: { min?: number; max?: number } | null =
    viewport?.pinchZoom === true
      ? {}
      : (viewport?.pinchZoom || null);
  const animatedZoomObj = typeof viewport?.animatedZoom === 'object' ? viewport.animatedZoom : undefined;
  const animateEnabled = !!viewport?.animatedZoom;
  const animateDuration = animatedZoomObj?.duration;
  const animateResetDuration = animatedZoomObj?.resetDuration;
  const animateEasing = animatedZoomObj?.easing;

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

  const pickEveryProp = geometry?.pickEvery;
  const boundsOfProp = geometry?.boundsOf;
  const moveOptions = selectToolOpts?.move;
  const resizeOptions = selectToolOpts?.resize;
  const rotateOptions = selectToolOpts?.rotate;
  const snap = selectToolOpts?.snap;
  const handleHitRadius = selectToolOpts?.handleHitRadius;
  const commitInsert = insertTool?.create;
  const insertLayer = insertTool?.layer;

  // Selection: caller-supplied wins; otherwise build from selectionOptions.
  // Hooks always run unconditionally — when a caller supplies `selection`,
  // the internally-built one is unused but the hook still fires.
  const internalSelection = useSelection(selectionOptions ?? {});
  const selection = selectionProp ?? internalSelection;

  // Adapter: scene → MoveAdapter & ResizeAdapter & RotateAdapter, plus the
  // selection adapter methods so AreaSelectAdapter is satisfied. We also
  // wrap `setPose` to cascade container moves to descendants (Scene v1
  // stores absolute poses, so a container move requires translating each
  // child by the same delta in a single batch).
  const adapter = useMemo(() => {
    const base = sceneToAdapter(scene, { commitInsert, insertLayer, layouts });
    const collectDescendants = (id: string, out: string[]): void => {
      for (const cid of scene.childrenOf(asNodeId(id))) {
        out.push(cid);
        collectDescendants(cid, out);
      }
    };
    return {
      ...base,
      setPose(id: string, pose: TPose) {
        const n = scene.get(asNodeId(id));
        if (!n || n.kind !== 'container') {
          base.setPose(id, pose);
          return;
        }
        const prev = n.pose as unknown as { x: number; y: number };
        const next = pose as unknown as { x: number; y: number };
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        if (dx === 0 && dy === 0) {
          base.setPose(id, pose);
          return;
        }
        const desc: string[] = [];
        collectDescendants(id, desc);
        scene.batch('move container', () => {
          base.setPose(id, pose);
          for (const cid of desc) {
            const cn = scene.get(asNodeId(cid));
            if (!cn) continue;
            const cp = cn.pose as unknown as { x: number; y: number };
            base.setPose(cid, { ...(cn.pose as object), x: cp.x + dx, y: cp.y + dy } as unknown as TPose);
          }
        });
      },
      // Spread selection methods so the synthesized adapter satisfies
      // `AreaSelectAdapter` (which `useSelectTool` requires).
      ...selection.adapterMethods,
      // Default marquee hit-test: walk every renderOrder node and collect ids
      // whose AABB intersects the marquee rect. Path-shaped poses use their
      // path descriptor for a tighter test.
      hitTestArea: (rect: { x: number; y: number; width: number; height: number }): string[] => {
        const hits: string[] = [];
        for (const nid of scene.renderOrder()) {
          const n = scene.get(nid);
          if (!n) continue;
          if (isPathLike(n.pose) && pathPoseDescriptor.intersectsRect) {
            if (pathPoseDescriptor.intersectsRect(n.pose, rect)) hits.push(n.id);
            continue;
          }
          const b = aabbOfPose(n.pose);
          if (b.x < rect.x + rect.width && b.x + b.width > rect.x
            && b.y < rect.y + rect.height && b.y + b.height > rect.y) {
            hits.push(n.id);
          }
        }
        return hits;
      },
      // applyOps for marquee-driven SetSelection ops; actual pose mutation
      // ops aren't expected from the default area-select behaviors.
      applyOps: (ops: Op[]) => {
        for (const op of ops) op.apply(selection.adapterMethods);
      },
    };
  }, [scene, commitInsert, insertLayer, layouts, selection]);

  // Default cascade lookup for the move overlay — reads live world pose from
  // the scene. Caller's `moveOptions.cascadeWorldPose` (if any) wins.
  const wiredMoveOptions = useMemo<UseMoveOptions<TPose>>(() => {
    const defaultCascade = (id: string): TPose | null => {
      const n = scene.get(asNodeId(id));
      return n ? n.pose : null;
    };
    const merged: UseMoveOptions<TPose> = {
      cascadeWorldPose: defaultCascade,
      ...(moveOptions ?? {}),
    };
    // If `snap` was passed at the SceneCanvas level, prepend it to the
    // move behaviors. Caller-supplied move.behaviors still run after.
    if (snap) {
      const existing = merged.behaviors ?? [];
      merged.behaviors = [snapBehavior(snap), ...existing];
    }
    return merged;
  }, [scene, moveOptions, snap]);

  // Default pickEvery: walk renderOrder() back-to-front (top-most first) and
  // return the first node whose pose contains the world point. Wraps the
  // caller's `pickEvery` (string-or-null) into the array form `useSelectTool`
  // expects.
  const wiredHitBody = useMemo(() => {
    return (wx: number, wy: number): string[] => {
      if (pickEveryProp) {
        const id = pickEveryProp(wx, wy);
        return id ? [id] : [];
      }
      const ordered = [...scene.renderOrder()];
      for (let i = ordered.length - 1; i >= 0; i--) {
        const n = scene.get(ordered[i]);
        if (n && poseContains(n.pose, wx, wy)) return [n.id];
      }
      return [];
    };
  }, [scene, pickEveryProp]);

  const wiredBoundsOf = useMemo(() => {
    return (id: string): Bounds | null => {
      if (boundsOfProp) return boundsOfProp(id);
      const n = scene.get(asNodeId(id));
      return n ? aabbOfPose(n.pose) : null;
    };
  }, [scene, boundsOfProp]);

  const internalSelect = useSelectTool<Node<TData, TLayer, TPose>, TPose>(adapter, {
    pickEvery: wiredHitBody,
    boundsOf: wiredBoundsOf,
    ...(handleHitRadius !== undefined ? { handleHitRadius } : {}),
    move: wiredMoveOptions,
    ...(resizeOptions ? { resize: resizeOptions } : {}),
    ...(rotateOptions ? { rotate: rotateOptions } : {}),
    getObject: (id: string) => scene.get(asNodeId(id)) ?? null,
    // Live selection getter so the tool's `previewBounds` can synthesize the
    // `MULTI_RESIZE_TARGET_ID` union for `selectionMode="multi"`.
    getSelection: () => selection.current,
  });
  // Viewport hooks — called unconditionally (hooks cannot be conditional).
  // Each tool is a noop when its config is absent: useHandTool with
  // `inertia: false` behaves as the basic pan tool, useKeyboardZoomTool
  // ignores `animate` when false, and usePinchZoomTool noops when its
  // canvasRef is null.
  const handToolInertia = inertiaConfig === false
    ? undefined
    : { friction: inertiaConfig.friction, minSpeed: inertiaConfig.minSpeed, boundary: inertiaConfig.boundary, bounds: inertiaConfig.bounds };
  const handTool = useHandTool(handToolInertia ? { inertia: handToolInertia } : {});
  const keyZoomTool = useKeyboardZoomTool(animateEnabled ? { animate: true, duration: animateDuration, resetDuration: animateResetDuration, easing: animateEasing } : {});
  // Trackpad pinch on Mac is delivered as ctrl+wheel, not pointer events.
  // Register useWheelZoomTool alongside usePinchGesture so both touch and
  // trackpad pinch are handled when pinchZoom is enabled.
  const wheelZoomTool = useWheelZoomTool(pinchConfig !== null ? { min: pinchConfig.min, max: pinchConfig.max } : {});
  usePinchZoomTool(
    internalCanvasRef,
    currentViewRef.current,
    handleViewChange,
    { ...(pinchConfig ?? {}), enabled: pinchConfig !== null },
  );

  // keyZoom and wheelZoom are always-on (ambient); handTool must be in the
  // registry so H keybinding and space hotkey work via useKeybindings.
  const viewportAmbient: AnyTool[] = viewport
    ? [keyZoomTool, ...(pinchConfig !== null ? [wheelZoomTool] : [])]
    : [];
  const mergedAmbient = [...viewportAmbient, ...(ambient ?? [])];

  const internalRegistry: Record<string, AnyTool> = viewport
    ? { select: internalSelect, hand: handTool }
    : { select: internalSelect };

  const internalTools = useTools({
    active: 'select',
    registry: internalRegistry,
    ...(mergedAmbient.length ? { ambient: mergedAmbient } : {}),
  });

  useKeybindings(internalTools, { disable: !!toolsProp });

  const tools = toolsProp ?? internalTools;

  const wiredGestures = { undoRedo: { adapter: scene }, ...gestures };

  // Preview-ghost layer: renders in-flight gesture poses on top of the
  // committed scene using the scene slot's `drawOne`. The active tool
  // publishes which ids are displaced (`previewIds`) and their interim
  // poses (`previewPose`); we simply iterate them and reuse `drawOne`.
  // This replaces the per-tool `drawGhost` fold-in — a single SceneCanvas
  // concern instead of every consumer wiring it.
  const sceneSlot = layers.scene;
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const toolsRef = useRef(tools);
  toolsRef.current = tools;
  const sceneSlotRef = useRef(sceneSlot);
  sceneSlotRef.current = sceneSlot;
  const previewLayer = useMemo<RenderLayer<unknown>>(() => ({
    id: 'preview-ghost',
    label: 'Preview ghost',
    draw: (ctx, _data, view) => {
      const slot = sceneSlotRef.current;
      if (!slot || !slot.drawOne) return;
      const t = toolsRef.current;
      const tool = t.registry[t.hotkeyEngaged ?? t.active];
      const ids = tool?.previewIds?.();
      if (!ids) return;
      const sc = sceneRef.current;
      const drawOne = slot.drawOne;
      ctx.save();
      ctx.globalAlpha = 0.85;
      for (const id of ids) {
        const pose = tool?.previewPose?.(id) as TPose | null | undefined;
        if (pose == null) continue;
        const node = sc.get(asNodeId(id));
        if (!node) continue;
        drawOne(ctx, node, pose, view);
      }
      ctx.restore();
    },
  }), []);

  const wiredLayers = useMemo<LayersMap<Node<TData, TLayer, TPose>, TPose>>(() => ({
    ...layers,
    previewGhost: { layer: previewLayer, after: 'scene' },
  }), [layers, previewLayer]);

  // Merge the forwarded ref with our internalCanvasRef so usePinchZoomTool
  // can read the canvas element even when the consumer also forwards a ref.
  const mergedRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      internalCanvasRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLCanvasElement | null>).current = node;
    },
    [ref],
  );

  return (
    <Canvas<Node<TData, TLayer, TPose>, TPose>
      ref={mergedRef}
      adapter={adapter}
      gestures={wiredGestures}
      selection={selection}
      tools={tools}
      layers={wiredLayers}
      {...(viewProp !== undefined ? { view: viewProp } : {})}
      {...(defaultView !== undefined ? { defaultView } : {})}
      onViewChange={handleViewChange}
      {...restProps}
    />
  );
}

export const SceneCanvas = forwardRef(SceneCanvasInner) as <
  TData, TLayer extends string, TPose,
>(
  props: SceneCanvasProps<TData, TLayer, TPose> & { ref?: React.Ref<HTMLCanvasElement> },
) => ReturnType<typeof SceneCanvasInner>;
