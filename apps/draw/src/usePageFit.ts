import { fitViewToBounds, useLatest, type View } from '@weasel-js/core';
import { useCallback, useEffect, useRef } from 'react';
import type { PageSize } from './pageLayers';
import type { PaperSizeKey } from './paperSizes';

/**
 * Fits the page to the workspace on the first measured size and on every paper-size change,
 * deliberately not on later resizes, which would hijack the user's pan and zoom. Returns the
 * refit itself, for `viewport.recenter`; its identity never changes.
 */
export function usePageFit(
  workspace: { width: number; height: number },
  paperSize: PaperSizeKey,
  page: PageSize,
  setView: (view: View) => void,
): () => void {
  const lastFitPaperRef = useRef<PaperSizeKey | null>(null);
  const workspaceRef = useLatest(workspace);
  const pageRef = useLatest(page);
  const setViewRef = useLatest(setView);
  const recenter = useCallback(() => {
    const dims = workspaceRef.current;
    if (dims.width === 0 || dims.height === 0) return;
    const p = pageRef.current;
    setViewRef.current(fitViewToBounds(
      { x: 0, y: 0, width: p.width, height: p.height },
      dims,
      { x: 0, y: 0, scale: { x: 1, y: 1 } },
      { padding: 24 },
    ));
  }, [workspaceRef, pageRef, setViewRef]);
  useEffect(() => {
    if (workspace.width === 0 || workspace.height === 0) return;
    if (lastFitPaperRef.current === paperSize) return;
    lastFitPaperRef.current = paperSize;
    recenter();
  }, [paperSize, workspace.width, workspace.height, page.width, page.height, recenter]);
  return recenter;
}
