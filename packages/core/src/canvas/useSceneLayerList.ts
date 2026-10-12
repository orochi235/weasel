import { useCallback, useSyncExternalStore } from 'react';

interface LayerListSource {
  getLayers?: () => readonly { id: string }[];
  subscribeLayers?: (listener: () => void) => () => void;
}

const UNSUBSCRIBED = (): void => {};

const read = (adapter: LayerListSource | undefined): string =>
  typeof adapter?.getLayers === 'function' ? adapter.getLayers().map((l) => l.id).join('\n') : '';

/**
 * The adapter's scene-layer ids as a render input: a string that changes when
 * a layer is added, removed, or reordered. A scene write repaints without
 * re-rendering, so the adapter's `subscribeLayers` is what tells React.
 */
export function useSceneLayerList(adapter: LayerListSource | undefined): string {
  const subscribe = useCallback(
    (listener: () => void) => adapter?.subscribeLayers?.(listener) ?? UNSUBSCRIBED,
    [adapter],
  );
  const snapshot = useCallback(() => read(adapter), [adapter]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
