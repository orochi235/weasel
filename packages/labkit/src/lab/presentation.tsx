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
  /** A presented trial's play controls, when it shows them. */
  transport: PresentedTransportOptions | null;
}

/** How a presented trial shows its play controls. */
export interface PresentedTransportOptions {
  /** Below this width, in CSS pixels, the presented box hides them. They stay
   *  mounted, so their keys and replay still run. Default 480. */
  minWidth?: number;
  /** How a speed reads, as `<TrialTransport formatRate>`. */
  formatRate?: (rate: number) => string;
}

export const PresentationContext = createContext<PresentationContextValue | null>(null);

/** A lab's presentation mode, for its context: started at mount when
 *  `startsPresenting`, presenting the focused trial while active. */
export function useLabPresentation(
  startsPresenting: boolean,
  focusedTrialId: string | null,
  labBody: HTMLElement | null,
  transport: boolean | PresentedTransportOptions,
): PresentationContextValue {
  const minWidth =
    transport === false ? null : transport === true ? 480 : (transport.minWidth ?? 480);
  const formatRate = typeof transport === 'object' ? transport.formatRate : undefined;
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
      transport: minWidth === null ? null : { minWidth, ...(formatRate ? { formatRate } : {}) },
    }),
    [presenting, focusedTrialId, minWidth, formatRate],
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

/** How the trial `trialId` shows its play controls, while it is presented
 *  with them. */
export function usePresentedTransport(trialId: string): PresentedTransportOptions | null {
  const value = useContext(PresentationContext);
  return value?.trialId === trialId ? value.transport : null;
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
