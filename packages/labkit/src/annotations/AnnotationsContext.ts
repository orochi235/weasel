import { createContext, useCallback, useContext, useRef, useSyncExternalStore } from 'react';
import type { AnnotationsApi } from './types';

/** Null in a trial whose instrument declares no `annotations`. */
export const AnnotationsContext = createContext<AnnotationsApi | null>(null);

/** Re-render the caller whenever any of the store's scenes changes.
 *
 *  The API is a stable facade over mutable scenes, so nothing about its
 *  identity says a mark was added — a component reading `query()` without this
 *  renders one answer and never revises it. */
function useMarkVersion(api: AnnotationsApi | null): void {
  const version = useRef(0);
  useSyncExternalStore(
    useCallback(
      (fn: () => void) =>
        api?.subscribe(() => {
          version.current += 1;
          fn();
        }) ?? (() => {}),
      [api],
    ),
    useCallback(() => version.current, []),
    () => 0,
  );
}

/** The marks on this trial's targets. Reached through a hook rather than the
 *  chrome context, which carries no instrument state — a sidebar panel listing
 *  marks pulls it the way `useTrialState()` does. Throws outside a trial whose
 *  instrument declares the capability. */
export function useAnnotations(): AnnotationsApi {
  const api = useContext(AnnotationsContext);
  useMarkVersion(api);
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
  const api = useContext(AnnotationsContext);
  useMarkVersion(api);
  return api;
}
