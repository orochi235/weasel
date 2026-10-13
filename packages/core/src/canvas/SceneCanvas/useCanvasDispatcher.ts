import { useRef, useState, type MutableRefObject } from 'react';
import { createDispatcher, type Action, type Dispatcher } from '@weasel-js/routing';
import type { GestureSource } from '../gestureBounds';
import { createDispatcherPreviewSources, createGestureSource } from './dispatcherGestureBounds';

/**
 * One `Dispatcher` for the life of a `<SceneCanvas>`, shared by the gesture
 * mounter that pumps input into it and the layers that walk its in-flight
 * handles, with the lookups those layers and `<Canvas>` read it through.
 */
export function useCanvasDispatcher(): {
  dispatcher: Dispatcher;
  /** How the dispatcher resolves an action id at call time. Populated by
   *  `StandardActionsRegistrar` once it has the registry in scope. */
  getActionRef: MutableRefObject<((id: string) => Action | undefined) | null>;
  /** In-flight preview ids, nascent-insert bounds, and the pump signal. */
  gestureSource: GestureSource;
  /** Ids whose committed paint an in-flight ghost hides. */
  previewIdsExtra: () => string[];
  /** The pose an in-flight handle proposes for an id. */
  previewPoseExtra: (id: string) => unknown;
} {
  const getActionRef = useRef<((id: string) => Action | undefined) | null>(null);
  const dispatcherRef = useRef<Dispatcher | null>(null);
  if (!dispatcherRef.current) {
    dispatcherRef.current = createDispatcher({
      getAction: (id) => getActionRef.current?.(id),
    });
  }
  const dispatcher = dispatcherRef.current;
  const [gestureSource] = useState(() => createGestureSource(() => dispatcherRef.current));
  const [{ previewIdsExtra, previewPoseExtra }] = useState(
    () => createDispatcherPreviewSources(() => dispatcherRef.current),
  );
  return { dispatcher, getActionRef, gestureSource, previewIdsExtra, previewPoseExtra };
}
