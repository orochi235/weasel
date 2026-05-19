/**
 * ActiveToolContext — runtime selection state for tools.
 *
 * Holds the currently active tool id and a hotkey stack (tools held active
 * temporarily, e.g. space-for-hand). Read by the gesture dispatcher to
 * determine which tool's bindings are in scope; written by tool-switching
 * actions (`tool.activate:<id>`) and hold-hotkey actions (`tool.hold:<id>`).
 *
 * See `docs/superpowers/specs/2026-05-16-registry-unification-design.md`
 * § "Types" and § "Dispatcher contract".
 */

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

export interface ActiveToolContextValue {
  active: string;
  hotkeyStack: string[];
  setActive(id: string): void;
  pushHotkey(id: string): void;
  popHotkey(): void;
}

const ActiveToolContext = createContext<ActiveToolContextValue | null>(null);

export interface ActiveToolContextProviderProps {
  children: ReactNode;
  initialActive?: string;
}

export function ActiveToolContextProvider({
  children,
  initialActive = 'select',
}: ActiveToolContextProviderProps) {
  const [active, setActiveState] = useState(initialActive);
  const [hotkeyStack, setHotkeyStack] = useState<string[]>([]);

  const setActive = useCallback((id: string) => {
    setActiveState(id);
  }, []);
  const pushHotkey = useCallback((id: string) => {
    setHotkeyStack((s) => [...s, id]);
  }, []);
  const popHotkey = useCallback(() => {
    setHotkeyStack((s) => (s.length === 0 ? s : s.slice(0, -1)));
  }, []);

  const value = useMemo<ActiveToolContextValue>(
    () => ({ active, hotkeyStack, setActive, pushHotkey, popHotkey }),
    [active, hotkeyStack, setActive, pushHotkey, popHotkey],
  );

  return (
    <ActiveToolContext.Provider value={value}>{children}</ActiveToolContext.Provider>
  );
}

export function useActiveToolContext(): ActiveToolContextValue {
  const value = useContext(ActiveToolContext);
  if (value === null) {
    throw new Error(
      'useActiveToolContext: no ActiveToolContextProvider in scope. Wrap your tree with <ActiveToolContextProvider> (typically inside <SceneCanvas>).',
    );
  }
  return value;
}

/**
 * Like `useActiveToolContext`, but returns `null` when no
 * `<ActiveToolContextProvider>` is in scope instead of throwing. Used by
 * `useStandardActions` to preserve its silent-no-op contract when no provider
 * is present.
 */
export function useOptionalActiveToolContext(): ActiveToolContextValue | null {
  return useContext(ActiveToolContext);
}

/**
 * Conditional `<ActiveToolContextProvider>` wrapper. Mounts a provider only
 * when no parent provider is in scope — otherwise renders children unwrapped
 * so callers (e.g. `<WeaselProvider>`, `<SceneCanvas>`) defer to the host's
 * existing scope. Mirrors `ActionsProviderIfRoot` / `DepRegistryProviderIfRoot`.
 */
export function ActiveToolContextProviderIfRoot({
  children,
}: {
  children: ReactNode;
}) {
  const parent = useContext(ActiveToolContext);
  if (parent !== null) return <>{children}</>;
  return <ActiveToolContextProvider>{children}</ActiveToolContextProvider>;
}
