import { useLatest } from '@weasel-js/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { lensIdsOf } from './lensScene';
import type { LensScene } from './lensTypes';

/**
 * Reports the lens each new selection focuses, and the selected lens again on a press on a lens that leaves the
 * selection as it was, so a press takes the focus back from a chrome toggle. The press half runs around the
 * dispatcher's own: `start` in the capture phase, before the press picks, and `end` after it.
 */
export function useFocusReports<C>(
  scene: LensScene<C>,
  onFocusLens: ((id: string | null) => void) | undefined,
) {
  const focusRef = useLatest(onFocusLens);
  const press = useRef({ on: false, reported: false });
  const report = useCallback(() => {
    const first = scene.getSelection()[0];
    focusRef.current?.(first === undefined ? null : (lensIdsOf(scene, first)?.lensId ?? null));
  }, [scene, focusRef]);
  useEffect(() => {
    let last = scene.getSelection();
    return scene.subscribe(() => {
      const next = scene.getSelection();
      if (next === last) return;
      last = next;
      press.current.reported = true;
      report();
    });
  }, [scene, report]);
  return useMemo(
    () => ({
      start: () => {
        press.current = { on: true, reported: false };
      },
      end: (e: { target: EventTarget | null }) => {
        const { on, reported } = press.current;
        press.current = { on: false, reported: false };
        const hit = e.target instanceof Element && e.target.closest('.lk-lens-hit');
        if (on && !reported && hit && scene.getSelection().length > 0) report();
      },
    }),
    [scene, report],
  );
}
