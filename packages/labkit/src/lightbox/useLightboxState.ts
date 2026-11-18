import { useLatest } from '@weasel-js/core';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import type { LightboxContextValue } from './LightboxContext';

/** Disabling closes an open lightbox for good: its owner hears it, and enabling it again does not reopen it. */
function useDisablingCloses(
  disabled: boolean,
  open: boolean,
  setOwn: (open: boolean) => void,
  onChangeRef: { readonly current: ((expanded: boolean) => void) | undefined },
): void {
  const [wasDisabled, setWasDisabled] = useState(disabled);
  const [closings, setClosings] = useState(0);
  if (disabled !== wasDisabled) {
    setWasDisabled(disabled);
    if (disabled && open) {
      setOwn(false);
      setClosings((n) => n + 1);
    }
  }
  useLayoutEffect(() => {
    if (closings > 0) onChangeRef.current?.(false);
  }, [closings, onChangeRef]);
}

/** A lightbox's open state, controlled or its own. */
export interface LightboxState {
  expanded: boolean;
  /** Opens or closes it, telling the owner; a no-op when it is already so. */
  set: (next: boolean) => void;
  /** What `useLightbox` hands content inside it; null while disabled. */
  ctx: LightboxContextValue | null;
  /** Whether content inside has taken over the expand button. */
  claimed: boolean;
}

/** Whether a lightbox is open, the one way to change it, and the context its content reads. */
export function useLightboxState(
  disabled: boolean,
  expandedProp: boolean | undefined,
  onExpandedChange: ((expanded: boolean) => void) | undefined,
): LightboxState {
  const [own, setOwn] = useState(false);
  const expanded = !disabled && (expandedProp ?? own);
  const onChangeRef = useLatest(onExpandedChange);
  const expandedRef = useLatest(expanded);
  const [claims, setClaims] = useState(0);
  useDisablingCloses(disabled, expandedProp ?? own, setOwn, onChangeRef);

  const set = useCallback(
    (next: boolean) => {
      if (next === expandedRef.current) return;
      setOwn(next);
      onChangeRef.current?.(next);
    },
    [expandedRef, onChangeRef],
  );
  const ctx = useMemo<LightboxContextValue | null>(
    () =>
      disabled
        ? null
        : {
            expanded,
            open: () => set(true),
            close: () => set(false),
            toggle: () => set(!expandedRef.current),
            claimControl: () => {
              setClaims((n) => n + 1);
              return () => setClaims((n) => n - 1);
            },
          },
    [disabled, expanded, set, expandedRef],
  );
  return { expanded, set, ctx, claimed: claims > 0 };
}
