import { createContext, useContext } from 'react';
import type { AnnotationsApi } from './types';

/** Null in a trial whose instrument declares no `annotations`. */
export const AnnotationsContext = createContext<AnnotationsApi | null>(null);

/** The marks on this trial's targets. Reached through a hook rather than the
 *  chrome context, which carries no instrument state — a sidebar panel listing
 *  marks pulls it the way `useTrialState()` does. Throws outside a trial whose
 *  instrument declares the capability. */
export function useAnnotations(): AnnotationsApi {
  const api = useContext(AnnotationsContext);
  if (!api) {
    throw new Error(
      '[labkit] useAnnotations requires an instrument that declares the `annotations` capability',
    );
  }
  return api;
}

/** The marks on this trial's targets, or null. For chrome that renders in
 *  every trial and does something else where there are none. */
export function useAnnotationsOptional(): AnnotationsApi | null {
  return useContext(AnnotationsContext);
}
