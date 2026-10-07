import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
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
  /** Whether a presented trial with a clock shows its play controls. */
  transport: boolean;
}

export const PresentationContext = createContext<PresentationContextValue | null>(null);

/** A lab's presentation mode, for its context: started at mount when
 *  `startsPresenting`, presenting the focused trial while active. */
export function useLabPresentation(
  startsPresenting: boolean,
  focusedTrialId: string | null,
  labBody: HTMLElement | null,
  transport: boolean,
): PresentationContextValue {
  // `mount` when the lab started presenting, `enter` when asked to since.
  const [presentedBy, setPresentedBy] = useState<'mount' | 'enter' | null>(
    startsPresenting ? 'mount' : null,
  );
  const presenting = presentedBy !== null;

  // Only a lab asked to present has a workspace to go back to.
  useEffect(() => {
    if (presentedBy !== 'enter' || !labBody) return;
    const doc = labBody.ownerDocument;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      setPresentedBy(null);
    };
    doc.addEventListener('keydown', onKeyDown);
    return () => doc.removeEventListener('keydown', onKeyDown);
  }, [presentedBy, labBody]);

  return useMemo(
    () => ({
      active: presenting,
      enter: () => setPresentedBy((by) => by ?? 'enter'),
      exit: () => setPresentedBy(null),
      trialId: presenting ? focusedTrialId : null,
      transport,
    }),
    [presenting, focusedTrialId, transport],
  );
}

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

/** Whether the trial `trialId` is presented with its play controls. */
export function usePresentedTransport(trialId: string): boolean {
  const value = useContext(PresentationContext);
  return value?.trialId === trialId && value.transport;
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
