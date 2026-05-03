/**
 * `<SceneCanvas>` — `<Canvas>` wired to a `Scene` primitive.
 *
 * Synthesizes a `MoveAdapter & ResizeAdapter & RotateAdapter` from the
 * passed `scene` (via `sceneToAdapter`) and forwards everything else to
 * `<Canvas>`. The `adapter` prop is owned by the wrapper and should not be
 * passed alongside `scene`.
 *
 * Cascade defaults: Scene v1 stores absolute poses, so dragging a container
 * needs (a) the live overlay to translate descendants and (b) commit-time
 * setPose to translate descendants too. SceneCanvas wires both by default
 * from `scene` knowledge (children-of-id + absolute pose lookup); consumers
 * can override either by passing their own `moveOptions.cascadeWorldPose`
 * or by passing a custom `adapter` upstream (not exposed here).
 */
import { forwardRef, useMemo } from 'react';
import type React from 'react';
import { Canvas } from './Canvas';
import type { CanvasProps } from './Canvas';
import { sceneToAdapter, type SceneToAdapterOptions } from './sceneAdapter';
import type { Node, Scene } from '../core/scene/types';
import { asNodeId } from '../core/scene/types';

export type SceneCanvasProps<TData, TLayer extends string, TPose> =
  Omit<CanvasProps<Node<TData, TLayer, TPose>, TPose>, 'adapter' | 'items' | 'setItems' | 'toPose' | 'fromPose' | 'createDefault' | 'poseBounds' | 'intersectsRect'>
  & {
    scene: Scene<TData, TLayer, TPose>;
    /** Optional insert-gesture factory. When present, the synthesized adapter
     *  exposes `commitInsert` and inserted objects are added as leaves on
     *  `insertLayer` (default `'default'`). */
    commitInsert?: SceneToAdapterOptions<TData, TLayer, TPose>['commitInsert'];
    /** Layer for inserted nodes. Defaults to the trivial-form layer. */
    insertLayer?: TLayer;
  };

function SceneCanvasInner<TData, TLayer extends string, TPose>(
  props: SceneCanvasProps<TData, TLayer, TPose>,
  ref: React.ForwardedRef<HTMLCanvasElement>,
) {
  const { scene, gestures, moveOptions, commitInsert, insertLayer, ...rest } = props;

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
    };
  }, [scene, commitInsert, insertLayer]);

  const wiredGestures = { undoRedo: { adapter: scene }, ...gestures };

  const wiredMoveOptions = useMemo(() => {
    const defaultCascade = (id: string): TPose | null => {
      const n = scene.get(asNodeId(id));
      return n ? n.pose : null;
    };
    return { cascadeWorldPose: defaultCascade, ...(moveOptions ?? {}) };
  }, [scene, moveOptions]);

  return (
    <Canvas<Node<TData, TLayer, TPose>, TPose>
      ref={ref}
      adapter={adapter}
      gestures={wiredGestures}
      moveOptions={wiredMoveOptions}
      {...rest}
    />
  );
}

export const SceneCanvas = forwardRef(SceneCanvasInner) as <
  TData, TLayer extends string, TPose,
>(
  props: SceneCanvasProps<TData, TLayer, TPose> & { ref?: React.Ref<HTMLCanvasElement> },
) => ReturnType<typeof SceneCanvasInner>;
