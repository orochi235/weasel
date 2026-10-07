import { useContext, useEffect, useState } from 'react';
import { AnnotationPreloadContext } from '../annotations/preload';
import type { AnnotationStorage } from '../annotations/types';

/** The marks an instrument keeps in its own storage: preloaded by the lab for
 *  the trials it opened with, loaded here for any added since. */
export function useKeptMarks(
  storage: AnnotationStorage | undefined,
  trialId: string,
): { ready: boolean; value: unknown } {
  const preload = useContext(AnnotationPreloadContext);
  const [loaded, setLoaded] = useState<{ value: unknown } | null>(() =>
    storage && preload?.has(trialId) ? { value: preload.get(trialId) } : null,
  );
  useEffect(() => {
    if (!storage || loaded) return;
    let live = true;
    storage.load().then(
      (value) => {
        if (live) setLoaded({ value });
      },
      (error) => {
        console.warn(`[labkit] could not load the marks of trial "${trialId}"`, error);
        if (live) setLoaded({ value: null });
      },
    );
    return () => {
      live = false;
    };
  }, [storage, loaded, trialId]);
  if (!storage) return { ready: true, value: undefined };
  return loaded ? { ready: true, value: loaded.value } : { ready: false, value: undefined };
}
