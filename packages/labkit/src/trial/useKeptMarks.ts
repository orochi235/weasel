import { useContext, useEffect, useState } from 'react';
import { AnnotationPreloadContext } from '../annotations/preload';
import type { AnnotationStorage } from '../annotations/types';

interface Loaded {
  storage: AnnotationStorage;
  trialId: string;
  value: unknown;
}

/** The marks an instrument keeps in its own storage: preloaded by the lab for
 *  the trials it opened with, loaded here for any added since, and loaded
 *  again when the trial's storage changes. */
export function useKeptMarks(
  storage: AnnotationStorage | undefined,
  trialId: string,
): { ready: boolean; value: unknown } {
  const preload = useContext(AnnotationPreloadContext);
  const [loaded, setLoaded] = useState<Loaded | null>(() =>
    storage && preload?.has(trialId) ? { storage, trialId, value: preload.get(trialId) } : null,
  );
  const current =
    loaded && loaded.storage === storage && loaded.trialId === trialId ? loaded : null;
  useEffect(() => {
    if (!storage || current) return;
    let live = true;
    storage.load().then(
      (value) => {
        if (live) setLoaded({ storage, trialId, value });
      },
      (error) => {
        console.warn(`[labkit] could not load the marks of trial "${trialId}"`, error);
        if (live) setLoaded({ storage, trialId, value: null });
      },
    );
    return () => {
      live = false;
    };
  }, [storage, current, trialId]);
  if (!storage) return { ready: true, value: undefined };
  return current ? { ready: true, value: current.value } : { ready: false, value: undefined };
}
