import { createContext, useContext, useLayoutEffect, useState } from 'react';
import { useSurfaceOptional } from '../surface/useSurfaceTile';

/** A lab's presentation mode: one trial, without the lab's chrome or its own. */
export interface Presentation {
  active: boolean;
  /** Present the focused trial. Escape returns to the workspace. */
  enter(): void;
  exit(): void;
}

interface PresentationContextValue extends Presentation {
  /** The trial being presented, while one is. */
  trialId: string | null;
}

export const PresentationContext = createContext<PresentationContextValue | null>(null);

/** The presentation mode of the `<Lab>` around the caller. */
export function usePresentation(): Presentation {
  const value = useContext(PresentationContext);
  if (!value) throw new Error('[labkit] usePresentation() must be called inside <Lab>');
  return value;
}

/** Whether the trial `trialId` is the one its lab is presenting. */
export function useIsPresented(trialId: string): boolean {
  return useContext(PresentationContext)?.trialId === trialId;
}

/** Whether the trial `trialId` is the one its lab is presenting, and a ref for
 *  its root: while presented, the lab's shared surface is scoped to it, so the
 *  tiles hidden behind it stop painting. */
export function usePresentedTrial(trialId: string): {
  presented: boolean;
  ref: (el: HTMLElement | null) => void;
} {
  const presented = useIsPresented(trialId);
  const surface = useSurfaceOptional();
  const [el, ref] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!presented || !el || !surface) return;
    surface.scope(el);
    return () => surface.scope(null);
  }, [presented, el, surface]);
  return { presented, ref };
}

/** Whether the page's URL asks for presentation with `?present`. */
export function hasPresentParam(): boolean {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).has('present');
}
