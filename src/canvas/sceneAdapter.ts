/**
 * Synthesize a `<Canvas>`-compatible adapter from a `Scene` primitive.
 *
 * The Scene owns nodes/poses/parenting and auto-records ops on every mutation.
 * `<SceneCanvas>` calls `sceneToAdapter(scene)` and forwards the result to
 * `<Canvas>`'s `adapter` prop. Selection and hit-testing are not part of the
 * Scene model — Canvas's internal `useSelection` and pose-derived hitBody
 * cover those.
 *
 * Pose semantics match the rest of the kit: `getPose` / `setPose` return /
 * write **local** coordinates (relative to parent). The Scene stores pose on
 * each node directly; world composition (when needed) is the renderer's job
 * via `composeWorldPose`, not the adapter's.
 */
import type { InsertAdapter, MoveAdapter, ResizeAdapter, RotateAdapter } from '../core/adapters/types';
import type { Op } from '../core/ops/types';
import type { Node, Scene } from '../core/scene/types';
import { asNodeId } from '../core/scene/types';

export type SceneCanvasAdapter<TData, TLayer extends string, TPose> =
  & MoveAdapter<Node<TData, TLayer, TPose>, TPose>
  & ResizeAdapter<Node<TData, TLayer, TPose>, TPose>
  & RotateAdapter<Node<TData, TLayer, TPose>, TPose>
  & Partial<InsertAdapter<Node<TData, TLayer, TPose>>>;

/** Optional extras for the synthesized adapter. Pass `commitInsert` to wire
 *  the insert gesture into a Scene-owned canvas; the returned object becomes
 *  a leaf on the layer named by `layer` (default `'default'`). */
export interface SceneToAdapterOptions<TData, TLayer extends string, TPose> {
  /** Factory for new objects. Returning `null` aborts the insert. */
  commitInsert?: (bounds: { x: number; y: number; width: number; height: number }) => {
    pose: TPose;
    data: TData;
    id?: string;
  } | null;
  /** Layer to place inserted nodes on. Defaults to the trivial-form layer. */
  insertLayer?: TLayer;
}

export function sceneToAdapter<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  options: SceneToAdapterOptions<TData, TLayer, TPose> = {},
): SceneCanvasAdapter<TData, TLayer, TPose> {
  const visibleLayers = (): Set<TLayer> => {
    const out = new Set<TLayer>();
    for (const layer of scene.layers) {
      if (layer.visible) out.add(layer.id);
    }
    return out;
  };

  return {
    getObject(id) {
      return scene.get(asNodeId(id));
    },
    getObjects() {
      const visible = visibleLayers();
      const out: Node<TData, TLayer, TPose>[] = [];
      for (const id of scene.renderOrder()) {
        const n = scene.get(id);
        if (n && visible.has(n.layer)) out.push(n);
      }
      return out;
    },
    getPose(id) {
      const n = scene.get(asNodeId(id));
      if (!n) throw new Error(`sceneToAdapter: unknown node "${id}"`);
      return n.pose;
    },
    getParent(id) {
      const n = scene.get(asNodeId(id));
      return n?.parent ?? null;
    },
    setPose(id, pose) {
      scene.setPose(asNodeId(id), pose);
    },
    setParent(id, parentId) {
      scene.move(asNodeId(id), parentId === null ? null : asNodeId(parentId));
    },
    getChildren(id) {
      return [...scene.childrenOf(asNodeId(id))];
    },
    applyBatch(ops: Op[], label: string) {
      scene.batch(label, () => {
        for (const op of ops) op.apply(this);
      });
    },
    // Insert support is opt-in: present only when `options.commitInsert` is.
    // The synthesized methods package the user's factory result into a leaf
    // add() against the configured layer.
    ...(options.commitInsert
      ? {
          commitInsert: (bounds: { x: number; y: number; width: number; height: number }) => {
            const created = options.commitInsert!(bounds);
            if (!created) return null;
            const layer = (options.insertLayer ?? ('default' as TLayer));
            const id = scene.add({
              kind: 'leaf',
              layer,
              pose: created.pose,
              data: created.data,
              ...(created.id ? { id: asNodeId(created.id) } : {}),
            });
            return scene.get(id) ?? null;
          },
          insertObject: (_node: Node<TData, TLayer, TPose>) => {
            // Kit-side InsertOp path: re-add by spec. Used for redo.
            // Trivial Scene path doesn't expose a serializable InsertOp seam
            // yet; commitInsert above covers the live-drag commit case.
          },
        }
      : {}),
  };
}
