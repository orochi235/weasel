/**
 * DispatcherPresence — a tiny React context exposed by the gesture
 * dispatcher (Phase 3 of registry unification) so legacy keybinding
 * listeners can detect that the new dispatcher is mounted and bypass
 * actions whose dispatch has migrated.
 *
 * See `docs/superpowers/specs/2026-05-16-registry-unification-design.md` § Q5.
 */
import { createContext, useContext, type ReactNode } from 'react';

const DispatcherPresenceContext = createContext(false);

export function DispatcherPresenceProvider({ children }: { children: ReactNode }) {
  return (
    <DispatcherPresenceContext.Provider value={true}>
      {children}
    </DispatcherPresenceContext.Provider>
  );
}

export function useIsDispatcherMounted(): boolean {
  return useContext(DispatcherPresenceContext);
}
