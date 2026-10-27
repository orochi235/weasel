import { type RefObject, useEffect, useReducer, useRef } from 'react';
import type { TrialInfo } from '../state/types';
import { AnnotationOverlay } from './AnnotationOverlay';
import type { AnnotationsApi, AnnotationsCapability } from './types';

/** Props for `<AnnotationTargets>`. */
export interface AnnotationTargetsProps {
  capability: AnnotationsCapability;
  state: unknown;
  config: unknown;
  /** The trial these targets belong to. `capability.targets` is told it, so a
   *  consumer holding per-trial refs can hand back this trial's. */
  trial: TrialInfo;
  annotations: AnnotationsApi;
  activeToolId: string | null;
}

/**
 * Renders again when a target's element attaches, changes size or scrolls anything inside it, so `targets` is asked
 * again: a target whose content box is its element's own size, or whose `shown` follows a scroll offset, would
 * otherwise keep what it had at the trial's last render.
 */
function useTargetChanges(refs: readonly RefObject<HTMLElement | null>[]): void {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const sizes = useRef(new Map<Element, string>());
  const observer = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const seen = sizes.current;
    const ro = new ResizeObserver((entries) => {
      let changed = false;
      for (const e of entries) {
        const size = `${e.contentRect.width}x${e.contentRect.height}`;
        if (seen.get(e.target) === size) continue;
        seen.set(e.target, size);
        changed = true;
      }
      if (changed) bump();
    });
    observer.current = ro;
    return () => {
      ro.disconnect();
      observer.current = null;
      for (const el of seen.keys()) el.removeEventListener('scroll', bump, true);
      seen.clear();
    };
  }, []);
  // Every commit: a ref only attaches at a commit, and nothing tells this component which one.
  useEffect(() => {
    const ro = observer.current;
    if (!ro) return;
    const live = new Set(refs.map((r) => r.current).filter((el): el is HTMLElement => el !== null));
    for (const el of [...sizes.current.keys()]) {
      if (live.has(el as HTMLElement)) continue;
      ro.unobserve(el);
      el.removeEventListener('scroll', bump, true);
      sizes.current.delete(el);
    }
    for (const el of live) {
      if (sizes.current.has(el)) continue;
      sizes.current.set(el, '');
      ro.observe(el);
      // `scroll` does not bubble; capturing on the target hears a scroller anywhere inside it.
      el.addEventListener('scroll', bump, { capture: true, passive: true });
    }
  });
}

/** One overlay per region the instrument said accepts marks. */
export function AnnotationTargets({
  capability,
  state,
  config,
  trial,
  annotations,
  activeToolId,
}: AnnotationTargetsProps) {
  const targets = capability.targets(state, config, trial);
  useTargetChanges(targets.map((t) => t.ref));

  return (
    <>
      {targets.map((t) => (
        <AnnotationOverlay
          key={t.id}
          target={t}
          scene={annotations.sceneFor(t.id)}
          meaning={capability.meaning}
          config={config}
          activeToolId={activeToolId}
        />
      ))}
    </>
  );
}
