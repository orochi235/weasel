/**
 * `<SceneCanvas>` — `<Canvas>` wired to a `Scene` primitive.
 *
 * Synthesizes a `MoveAdapter & ResizeAdapter & RotateAdapter` from the
 * passed `scene` (via `sceneToAdapter`) and forwards everything else to
 * `<Canvas>`. The `adapter` prop is owned by the wrapper and should not be
 * passed alongside `scene`.
 */
import { forwardRef, useMemo } from 'react';
import type React from 'react';
import { Canvas } from './Canvas';
import type { CanvasProps } from './Canvas';
import { sceneToAdapter } from './sceneAdapter';
import type { Node, Scene } from '../core/scene/types';

export type SceneCanvasProps<TData, TLayer extends string, TPose> =
  Omit<CanvasProps<Node<TData, TLayer, TPose>, TPose>, 'adapter' | 'items' | 'setItems' | 'toPose' | 'fromPose' | 'createDefault' | 'poseBounds' | 'intersectsRect'>
  & {
    scene: Scene<TData, TLayer, TPose>;
  };

function SceneCanvasInner<TData, TLayer extends string, TPose>(
  props: SceneCanvasProps<TData, TLayer, TPose>,
  ref: React.ForwardedRef<HTMLCanvasElement>,
) {
  const { scene, ...rest } = props;
  const adapter = useMemo(() => sceneToAdapter(scene), [scene]);
  return <Canvas<Node<TData, TLayer, TPose>, TPose> ref={ref} adapter={adapter} {...rest} />;
}

export const SceneCanvas = forwardRef(SceneCanvasInner) as <
  TData, TLayer extends string, TPose,
>(
  props: SceneCanvasProps<TData, TLayer, TPose> & { ref?: React.Ref<HTMLCanvasElement> },
) => ReturnType<typeof SceneCanvasInner>;
