import { useEffect } from 'react';
import { useLatest, isDev } from '@weasel-js/react';
import { installTestHookIfRequested, releaseTestHook } from './install';
import type { TestHookRefs } from './types';

/** The test hook for one canvas: opt-in via `?test=1`, never in a production
 *  build. `read` is called for the values of the last committed render. */
export function useTestHook(read: TestHookRefs): void {
  const live = useLatest(read);
  useEffect(() => {
    if (isDev()) {
      const hook = installTestHookIfRequested({
        getScene: () => live.current.getScene(),
        getSelectionIds: () => live.current.getSelectionIds(),
        getView: () => live.current.getView(),
        getActiveToolId: () => live.current.getActiveToolId(),
        ...(live.current.probes ? { probes: live.current.probes } : {}),
      });
      if (hook) {
        hook._markReady();
        return () => releaseTestHook(hook);
      }
    }
    return undefined;
  }, [live]);
}
