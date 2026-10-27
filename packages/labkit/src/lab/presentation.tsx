import type { ClockRegistry } from '@weasel-js/clock';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand/react';
import { TrialRootContext } from '../clock/contexts';
import type { LabStore } from '../state/store';
import { useSurfaceOptional } from '../surface/useSurfaceTile';
import { type PresentationMessageOptions, usePresentationMessages } from './presentationMessages';
import { type Still, stillOf, useStill } from './still';

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
  /** Whether a lab held still has been painted; `null` for any other lab. */
  still: 'pending' | 'ready' | null;
}

/** How a lab starts: presenting or not, and held still or not. */
export interface PresentationStart {
  presenting: boolean;
  still: Still | null;
}

/** How `<Lab present still>` and the page's URL say a lab starts. A still is
 *  a presentation, asked for or not. */
export function presentationStart(
  present: boolean | undefined,
  still: boolean | number | undefined,
): PresentationStart {
  const held = stillOf(still);
  return { presenting: present === true || held !== null || hasPresentParam(), still: held };
}

/** The class of a lab's root, which says how it is presenting. */
export function labClassName({ active, still }: PresentationContextValue): string {
  if (!active) return 'lk-lab';
  if (still === null) return 'lk-lab lk-lab--present';
  return `lk-lab lk-lab--present lk-lab--still${still === 'ready' ? ' lk-lab--still-ready' : ''}`;
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

const NO_OPTIONS: PresentationMessageOptions = {};

/** A lab's presentation mode, for its context: started at mount when `start`
 *  says so, presenting the focused trial while active. A still shows no play
 *  controls and answers no messages. */
export function useLabPresentation(
  start: PresentationStart,
  focusedTrialId: string | null,
  labBody: HTMLElement | null,
  clocks: ClockRegistry,
  store: LabStore,
  options: {
    transport: boolean | PresentedTransportOptions;
    messages: boolean | PresentationMessageOptions;
  },
): PresentationContextValue {
  const transport = start.still ? false : options.transport;
  const minWidth =
    transport === false ? null : transport === true ? 480 : (transport.minWidth ?? 480);
  const formatRate = typeof transport === 'object' ? transport.formatRate : undefined;
  // `mount` when the lab started presenting, `enter` when asked to since.
  const [presentedBy, setPresentedBy] = useState<'mount' | 'enter' | null>(
    start.presenting ? 'mount' : null,
  );
  const presenting = presentedBy !== null;
  const still = useStill(start.still, clocks, labBody);
  const clocked = useStore(store, (s) => {
    const record = s.trials.find((t) => t.id === focusedTrialId);
    const declared = record && s.instruments?.find((i) => i.name === record.instrumentName)?.clock;
    // A function may resolve to no clock, which never registers one to wait for.
    return Boolean(declared) && typeof declared !== 'function';
  });
  usePresentationMessages(
    presenting && !start.still && options.messages !== false,
    labBody?.ownerDocument.defaultView ?? null,
    clocks,
    focusedTrialId,
    clocked,
    typeof options.messages === 'object' ? options.messages : NO_OPTIONS,
  );

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
      still,
    }),
    [presenting, focusedTrialId, minWidth, formatRate, still],
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
 *  tiles hidden behind it stop painting. The ref also publishes the root as
 *  the trial's, which its clock registers as the element showing it. */
export function usePresentedTrial(trialId: string): {
  presented: boolean;
  ref: (el: HTMLElement | null) => void;
} {
  const presented = useIsPresented(trialId);
  const surface = useSurfaceOptional();
  const [el, setEl] = useState<HTMLElement | null>(null);
  const rootRef = useContext(TrialRootContext);
  const ref = useCallback(
    (node: HTMLElement | null) => {
      setEl(node);
      if (rootRef) rootRef.current = node;
    },
    [rootRef],
  );
  useLayoutEffect(() => {
    if (!presented || !el || !surface) return;
    surface.scope(el);
    return () => surface.scope(null);
  }, [presented, el, surface]);
  return { presented, ref };
}

/** Whether the page's URL asks for presentation with `?present`. */
function hasPresentParam(): boolean {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).has('present');
}
