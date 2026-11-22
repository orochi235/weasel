import { useEffect, useMemo } from 'react';
import type { Scene } from 'core/scene/types';
import { streamScene, type SceneSource, type SceneStream, type StreamSceneOptions } from './streamScene';

/** {@link streamScene} for a component: one stream while `scene` and `source` hold, disposed on
 *  unmount. Call its `update` from `<SceneCanvas onViewChange>` and once with the first view. */
export function useSceneStream<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  source: SceneSource<TData, TLayer, TPose>,
  opts?: StreamSceneOptions,
): SceneStream {
  // Read once: options that change mid-stream would need a new stream, and a new source does make one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stream = useMemo(() => streamScene(scene, source, opts), [scene, source]);
  useEffect(() => () => stream.dispose(), [stream]);
  return stream;
}
