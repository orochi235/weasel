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
import { forwardRef, useMemo } from 'react';
import type React from 'react';
import { Canvas } from './Canvas';
import type { CanvasProps } from './Canvas';
import { sceneToAdapter, type SceneToAdapterOptions } from './sceneAdapter';
import type { Node, Scene } from '../core/scene/types';
import { asNodeId } from '../core/scene/types';
import type { Op } from '../core/ops/types';
import { useSelection, type SelectionApi, type UseSelectionOptions } from '../features/selection/useSelection';
import { useSelectTool, type Bounds } from '../tools/builtin/useSelectTool';
import { useTools, type ToolsApi } from '../tools/useTools';
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
    | 'selection' | 'selectionOptions' | 'tools'
  >
  & {
    scene: Scene<TData, TLayer, TPose>;
    /** Optional insert-gesture factory. When present, the synthesized adapter
     *  exposes `commitInsert` and inserted objects are added as leaves on
     *  `insertLayer` (default `'default'`). */
    commitInsert?: SceneToAdapterOptions<TData, TLayer, TPose>['commitInsert'];
    /** Layer for inserted nodes. Defaults to the trivial-form layer. */
    insertLayer?: TLayer;

    // --- Tool-folded options (formerly forwarded to Canvas, now consumed
    //     by the internal `useSelectTool`). Ignored if the consumer passes
    //     their own `tools` prop. ---
    pickEvery?: (worldX: number, worldY: number) => string | null;
    boundsOf?: (id: string) => Bounds | null;
    handleHitRadius?: number;
    snap?: SnapStrategy<TPose>;
    moveOptions?: UseMoveOptions<TPose>;
    resizeOptions?: UseResizeOptions<TPose>;
    rotateOptions?: UseRotateOptions<TPose>;

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
     *  ignored — wire `alwaysOn` through your own `useTools` call instead. */
    alwaysOn?: AnyTool[];
  };

function SceneCanvasInner<TData, TLayer extends string, TPose>(
  props: SceneCanvasProps<TData, TLayer, TPose>,
  ref: React.ForwardedRef<HTMLCanvasElement>,
) {
  const {
    scene,
    gestures,
    commitInsert,
    insertLayer,
    pickEvery: pickEveryProp,
    boundsOf: boundsOfProp,
    handleHitRadius,
    snap,
    moveOptions,
    resizeOptions,
    rotateOptions,
    selection: selectionProp,
    selectionOptions,
    tools: toolsProp,
    alwaysOn,
    layers,
    ...rest
  } = props;

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
    const base = sceneToAdapter(scene, { commitInsert, insertLayer });
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
  }, [scene, commitInsert, insertLayer, selection]);

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

  // Extract the scene `drawOne` for ghost rendering. `layers.scene` may be
  // explicitly null (meaning "no default scene draw"); in that case ghosts
  // are not rendered (drawGhost stays undefined).
  const sceneSlot = layers.scene;
  const drawGhost = useMemo(() => {
    if (!sceneSlot || !sceneSlot.drawOne) return undefined;
    const drawOne = sceneSlot.drawOne;
    return (
      ctx: CanvasRenderingContext2D,
      node: Node<TData, TLayer, TPose> | null,
      pose: TPose,
      view: { x: number; y: number; scale: number },
    ) => {
      if (!node) return;
      drawOne(ctx, node, pose, view);
    };
  }, [sceneSlot]);

  const internalSelect = useSelectTool<Node<TData, TLayer, TPose>, TPose>(adapter, {
    pickEvery: wiredHitBody,
    boundsOf: wiredBoundsOf,
    ...(handleHitRadius !== undefined ? { handleHitRadius } : {}),
    move: wiredMoveOptions,
    ...(resizeOptions ? { resize: resizeOptions } : {}),
    ...(rotateOptions ? { rotate: rotateOptions } : {}),
    ...(drawGhost ? { drawGhost } : {}),
    getObject: (id: string) => scene.get(asNodeId(id)) ?? null,
    // Live selection getter so the tool's `peekBounds` can synthesize the
    // `MULTI_RESIZE_TARGET_ID` union for `selectionMode="multi"`.
    getSelection: () => selection.current,
  });
  const internalTools = useTools({
    active: 'select',
    registry: { select: internalSelect },
    ...(alwaysOn ? { alwaysOn } : {}),
  });

  const tools = toolsProp ?? internalTools;

  const wiredGestures = { undoRedo: { adapter: scene }, ...gestures };

  return (
    <Canvas<Node<TData, TLayer, TPose>, TPose>
      ref={ref}
      adapter={adapter}
      gestures={wiredGestures}
      selection={selection}
      tools={tools}
      layers={layers}
      {...rest}
    />
  );
}

export const SceneCanvas = forwardRef(SceneCanvasInner) as <
  TData, TLayer extends string, TPose,
>(
  props: SceneCanvasProps<TData, TLayer, TPose> & { ref?: React.Ref<HTMLCanvasElement> },
) => ReturnType<typeof SceneCanvasInner>;
