import { useEffect } from 'react';
import { useLatest } from '@weasel-js/react';
import { installTestHookIfRequested, releaseTestHook } from './install';
import type { TestHookRefs } from './types';

/** The test hook for one canvas: opt-in via `?test=1`, never in a production
 *  build. `read` is called for the values of the last committed render. */
export function useTestHook(read: TestHookRefs): void {
  const live = useLatest(read);
  useEffect(() => {
    // The gate must sit at this call site: a consumer's production build constant-folds
    // `process.env.NODE_ENV` and drops this block, but a called function can't be
    // tree-shaken even if its body is dead.
    if (process.env.NODE_ENV !== 'production') {
      const hook = installTestHookIfRequested({
        getScene: () => live.current.getScene(),
        getSelectionIds: () => live.current.getSelectionIds(),
        getView: () => live.current.getView(),
        getActiveToolId: () => live.current.getActiveToolId(),
      });
      if (hook) {
        hook._markReady();
        return () => releaseTestHook(hook);
      }
    }
    return undefined;
  }, [live]);
}
