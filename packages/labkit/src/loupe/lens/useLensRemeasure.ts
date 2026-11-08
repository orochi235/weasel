import { useEffect } from 'react';
import { useLabContext } from '../../lab/LabContext';

/** A source whose attached lenses can be told to look again at what lies under them. */
export interface Remeasurable {
  remeasure(): void;
}

/**
 * Has each source look again whenever what lies under a lens can change without a reticle moving: the trials, the
 * color mode, `also` (whatever else of the host's changes what a trial shows), a scroll, a resize, and a trial's host
 * no longer `data-pending`.
 */
export function useLensRemeasure(
  sources: readonly Remeasurable[],
  body: HTMLElement | null,
  rerender: () => void,
  also?: unknown,
) {
  const { trials, mode } = useLabContext();
  // biome-ignore lint/correctness/useExhaustiveDependencies: each is a change that can move what lies under a lens, and the effect's job is to re-run on it
  useEffect(() => {
    for (const source of sources) source.remeasure();
  }, [sources, trials, mode, also]);
  useEffect(() => {
    if (sources.length === 0 || !body) return;
    const remeasure = () => {
      for (const source of sources) source.remeasure();
    };
    // A resize can move the lab body, and with it every reticle's client point, which only a render recomputes.
    const resize = () => {
      rerender();
      remeasure();
    };
    body.addEventListener('scroll', remeasure, { capture: true, passive: true });
    window.addEventListener('resize', resize);
    // A host takes no pointer while `data-pending`, so a hit test skips it; a new story's host is only found once that
    // attribute goes, after the trials have already changed.
    const unveiled =
      typeof MutationObserver === 'undefined' ? null : new MutationObserver(remeasure);
    unveiled?.observe(body, { subtree: true, attributes: true, attributeFilter: ['data-pending'] });
    return () => {
      body.removeEventListener('scroll', remeasure, { capture: true });
      window.removeEventListener('resize', resize);
      unveiled?.disconnect();
    };
  }, [sources, body, rerender]);
}
