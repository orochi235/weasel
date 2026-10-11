import { useCallback, useState } from 'react';
import { useLatest } from '@weasel-js/react';

interface LayerListSource {
  getLayers?: () => readonly { id: string }[];
}

const read = (adapter: LayerListSource | undefined): string =>
  typeof adapter?.getLayers === 'function' ? adapter.getLayers().map((l) => l.id).join('\n') : '';

/**
 * The adapter's scene-layer ids as a render input. A scene write repaints
 * without re-rendering, so nothing on the React side sees a layer added,
 * removed, or reordered; the paint calls `sync` to find out.
 */
export function useSceneLayerList(adapter: LayerListSource | undefined): {
  /** Changes when the layer list does. A memo dependency. */
  key: string;
  /** Re-read the list. Returns `true`, having queued a render, when the
   *  layers built from `key` no longer match it. */
  sync(): boolean;
} {
  const [key, setKey] = useState(() => read(adapter));
  const live = useLatest({ adapter, key });
  const sync = useCallback((): boolean => {
    const now = read(live.current.adapter);
    if (now === live.current.key) return false;
    setKey(now);
    return true;
  }, [live]);
  return { key, sync };
}
