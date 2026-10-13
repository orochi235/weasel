import { useRef, useState } from 'react';
import { useLatest } from '@weasel-js/react';
import { createDispatcher, type ActionsRegistry, type Dispatcher } from '@weasel-js/routing';
import type { GestureSource } from '../gestureBounds';
import { createDispatcherPreviewSources, createGestureSource } from './dispatcherGestureBounds';

/**
 * One `Dispatcher` for the life of a `<SceneCanvas>`, shared by the gesture
 * mounter that pumps input into it and the layers that walk its in-flight
 * handles, with the lookups those layers and `<Canvas>` read it through. It
 * resolves an action id in `registry`, read at call time.
 */
export function useCanvasDispatcher(registry: ActionsRegistry | null): {
  dispatcher: Dispatcher;
  /** In-flight preview ids, nascent-insert bounds, and the pump signal. */
  gestureSource: GestureSource;
  /** Ids whose committed paint an in-flight ghost hides. */
  previewIdsExtra: () => string[];
  /** The pose an in-flight handle proposes for an id. */
  previewPoseExtra: (id: string) => unknown;
} {
  const registryRef = useLatest(registry);
  const dispatcherRef = useRef<Dispatcher | null>(null);
  if (!dispatcherRef.current) {
    dispatcherRef.current = createDispatcher({
      getAction: (id) => registryRef.current?.list().find((a) => a.id === id),
    });
  }
  const dispatcher = dispatcherRef.current;
  const [gestureSource] = useState(() => createGestureSource(() => dispatcherRef.current));
  const [{ previewIdsExtra, previewPoseExtra }] = useState(
    () => createDispatcherPreviewSources(() => dispatcherRef.current),
  );
  return { dispatcher, gestureSource, previewIdsExtra, previewPoseExtra };
}
