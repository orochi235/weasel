import { HOME_VIEW, fitViewToBounds, useLatest, type View } from '@weasel-js/core';
import { useCallback, useEffect, useRef } from 'react';
import type { PageSize } from './paperLayer';

const NOT_FIT = Symbol('not fit yet');

/** Options for {@link usePageFit}. */
export interface PageFitOptions {
  /** What the fit leaves around the page, in screen pixels. Default 24. */
  padding?: number;
}

/**
 * Fits the page — at the world origin unless it says where it is — to the workspace on the first measured size and whenever `fitKey` changes,
 * deliberately not on later resizes, which would hijack the user's pan and zoom. `page` is
 * `null` in a document without pages (`usePages`' `shown`), and the fit is then the world origin
 * at scale 1. Returns the refit itself, for `viewport.recenter`; its identity never changes.
 */
export function usePageFit(
  workspace: { width: number; height: number },
  fitKey: unknown,
  page: (PageSize & { x?: number; y?: number }) | null,
  setView: (view: View) => void,
  { padding = 24 }: PageFitOptions = {},
): () => void {
  const lastFitKeyRef = useRef<unknown>(NOT_FIT);
  const workspaceRef = useLatest(workspace);
  const pageRef = useLatest(page);
  const setViewRef = useLatest(setView);
  const recenter = useCallback(() => {
    const dims = workspaceRef.current;
    if (dims.width === 0 || dims.height === 0) return;
    const p = pageRef.current;
    if (p === null) {
      setViewRef.current(HOME_VIEW);
      return;
    }
    setViewRef.current(fitViewToBounds(
      { x: p.x ?? 0, y: p.y ?? 0, width: p.width, height: p.height },
      dims,
      HOME_VIEW,
      { padding },
    ) ?? HOME_VIEW);
  }, [workspaceRef, pageRef, setViewRef, padding]);
  useEffect(() => {
    if (workspace.width === 0 || workspace.height === 0) return;
    if (lastFitKeyRef.current === fitKey) return;
    lastFitKeyRef.current = fitKey;
    recenter();
  }, [fitKey, workspace.width, workspace.height, page?.width, page?.height, recenter]);
  return recenter;
}
