import { fitViewToBounds, useLatest, type View } from '@weasel-js/core';
import { useCallback, useEffect, useRef } from 'react';
import type { PageSize } from './paperLayer';

const NOT_FIT = Symbol('not fit yet');

/**
 * Fits the page — at the world origin unless it says where it is — to the workspace on the first measured size and whenever `fitKey` changes,
 * deliberately not on later resizes, which would hijack the user's pan and zoom. Returns the
 * refit itself, for `viewport.recenter`; its identity never changes.
 */
export function usePageFit(
  workspace: { width: number; height: number },
  fitKey: unknown,
  page: PageSize & { x?: number; y?: number },
  setView: (view: View) => void,
  padding = 24,
): () => void {
  const lastFitKeyRef = useRef<unknown>(NOT_FIT);
  const workspaceRef = useLatest(workspace);
  const pageRef = useLatest(page);
  const setViewRef = useLatest(setView);
  const recenter = useCallback(() => {
    const dims = workspaceRef.current;
    if (dims.width === 0 || dims.height === 0) return;
    const p = pageRef.current;
    setViewRef.current(fitViewToBounds(
      { x: p.x ?? 0, y: p.y ?? 0, width: p.width, height: p.height },
      dims,
      { x: 0, y: 0, scale: { x: 1, y: 1 } },
      { padding },
    ));
  }, [workspaceRef, pageRef, setViewRef, padding]);
  useEffect(() => {
    if (workspace.width === 0 || workspace.height === 0) return;
    if (lastFitKeyRef.current === fitKey) return;
    lastFitKeyRef.current = fitKey;
    recenter();
  }, [fitKey, workspace.width, workspace.height, page.width, page.height, recenter]);
  return recenter;
}
