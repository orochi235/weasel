import { useEffect, useMemo } from 'react';
import type { Scene } from 'core/scene/types';
import type { Dims } from 'core/layers/dims';
import type { View } from 'core/viewport/view';
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
  const handle = useMemo(() => new StreamHandle(scene, source, opts), [scene, source]);
  useEffect(() => handle.attach(), [handle]);
  return handle;
}

/** A stream made by the effect rather than the render: the stream adds an edit pass, so a render React
 *  throws away must not make one, and an effect React reruns must make a fresh one. Replays the last view. */
class StreamHandle<TData, TLayer extends string, TPose> implements SceneStream {
  private live: SceneStream | null = null;
  private last: { view: View; dims: Dims } | null = null;

  constructor(
    private readonly scene: Scene<TData, TLayer, TPose>,
    private readonly source: SceneSource<TData, TLayer, TPose>,
    private readonly opts: StreamSceneOptions | undefined,
  ) {}

  attach(): () => void {
    const live = streamScene(this.scene, this.source, this.opts);
    this.live = live;
    if (this.last) live.update(this.last.view, this.last.dims);
    return () => {
      live.dispose();
      if (this.live === live) this.live = null;
    };
  }

  readonly update = (view: View, dims: Dims): void => {
    this.last = { view, dims };
    this.live?.update(view, dims);
  };

  readonly stats = (): ReturnType<SceneStream['stats']> =>
    this.live?.stats() ?? { cells: 0, loading: 0, waiting: 0, nodes: 0 };

  readonly dispose = (): void => {
    this.live?.dispose();
    this.live = null;
  };
}
