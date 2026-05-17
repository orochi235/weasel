/**
 * `useViewDepSource` — builds a stable `ViewApi` that reads from
 * `currentViewRef` and writes via `onViewChange`.
 *
 * NOTE: this hook does **not** itself call `useDepSource('view', ...)` because
 * `useStandardActions` already publishes the `view` dep when it is passed in
 * its options bag. Returning the `ViewApi` here lets the registrar hand the
 * same instance to `useStandardActions` (which then registers it) without
 * having to reconstruct it inline.
 *
 * Kept as a per-dep module so the construction logic (closure refresh, ref
 * stability, etc.) has a single home next to the other dep modules.
 */
import { useRef } from 'react';
import type React from 'react';
import type { ViewApi } from 'interactions/actions/depSchema';
import type { View } from 'core/viewport/view';

export function useViewDepSource(
  currentViewRef: React.RefObject<View>,
  onViewChange: (v: View) => void,
): ViewApi {
  const viewApiRef = useRef<ViewApi>({
    get: () => currentViewRef.current,
    set: (v: View) => onViewChange(v),
  });
  // Refresh closures every render so the latest onViewChange is captured.
  viewApiRef.current = {
    get: () => currentViewRef.current,
    set: (v: View) => onViewChange(v),
  };
  return viewApiRef.current;
}
