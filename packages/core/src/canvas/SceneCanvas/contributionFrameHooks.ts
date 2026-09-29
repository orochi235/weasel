/**
 * Runs contributions' `beforePaint` / `afterPaint` on the surface's own frame
 * loop. One subscription per phase serves every entry, and only while some
 * entry declares that phase — a surface with no hooks subscribes to nothing.
 */
import { useEffect, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import type { CanvasExtensionApi } from '../canvasExtension';
import type {
  ContributionDepReader, ContributionFrameCtx, SurfaceContribution,
} from '../surfaceContribution';

type Phase = 'beforePaint' | 'afterPaint';

/**
 * Call every entry's `phase` hook in list order. A hook that throws is
 * reported through `console.error` the first time and skipped, so one broken
 * contribution costs its own work rather than the frame.
 */
export function runContributionFrameHooks(
  entries: readonly SurfaceContribution[],
  phase: Phase,
  ctx: ContributionFrameCtx,
  reported: WeakSet<object>,
): void {
  for (const entry of entries) {
    const hook = entry[phase];
    if (!hook) continue;
    try {
      hook(ctx);
    } catch (err) {
      if (reported.has(hook)) continue;
      reported.add(hook);
      console.error(`[weasel] contribution "${entry.id}" threw from ${phase}; the frame went on without it.`, err);
    }
  }
}

export function useContributionFrameHooks(
  entries: readonly SurfaceContribution[],
  api: CanvasExtensionApi | null,
  deps: ContributionDepReader,
): void {
  const hasBefore = entries.some((e) => e.beforePaint);
  const hasAfter = entries.some((e) => e.afterPaint);
  const entriesRef = useLatest(entries);
  const depsRef = useLatest(deps);
  const reported = useRef(new WeakSet<object>()).current;

  useEffect(() => {
    if (!api || !(hasBefore || hasAfter)) return;
    const ctxAt = (time: number): ContributionFrameCtx => ({
      time,
      view: api.getView(),
      requestFrame: api.requestRedraw,
      deps: depsRef.current,
    });
    const run = (phase: Phase) => (time: number) => {
      runContributionFrameHooks(entriesRef.current, phase, ctxAt(time), reported);
    };
    const offBefore = hasBefore ? api.subscribeBeforePaint(run('beforePaint')) : undefined;
    const offAfter = hasAfter ? api.subscribeFrame(run('afterPaint')) : undefined;
    // A hook arriving after the last paint would otherwise wait for an
    // unrelated redraw to run for the first time.
    api.requestRedraw();
    return () => { offBefore?.(); offAfter?.(); };
  }, [api, hasBefore, hasAfter, entriesRef, depsRef, reported]);
}
