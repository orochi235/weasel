/** A `<CanvasView>`'s own dispatcher, and what the view reads off it. */
import { useCallback, useMemo, useState } from 'react';
import type { View } from 'core/viewport/view';
import { createDispatcher, type SelectionApi } from '@weasel-js/routing';
import {
  createGestureSource,
  createDispatcherPreviewSources,
} from './SceneCanvas/dispatcherGestureBounds';
import type { ViewRuleInputs } from './viewInputs';

/**
 * One dispatcher per view: in-flight handles are per-view state, and two views
 * must not be able to see each other's. `own` is the gesture-shaped half of the
 * view's helpers, read off this dispatcher, which is where a gesture inside the
 * view lands; `ruleInputs` is the chrome-caps context the view answers for.
 */
export function useViewDispatcher(selectionNow: () => SelectionApi, camera: () => View) {
  const [dispatcher] = useState(createDispatcher);

  const own = useMemo(() => ({
    gestureSource: createGestureSource(() => dispatcher),
    ...createDispatcherPreviewSources(() => dispatcher),
  }), [dispatcher]);

  const ruleInputs = useCallback((): ViewRuleInputs => ({
    selection: selectionNow().get(),
    view: camera(),
    action: dispatcher.getActiveAction(),
  }), [camera, selectionNow, dispatcher]);

  return { dispatcher, own, ruleInputs };
}
