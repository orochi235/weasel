/**
 * ActiveToolContext — runtime selection state for tools.
 *
 * Holds the currently active tool id and a hotkey stack (tools held active
 * temporarily, e.g. space-for-hand). Read by the gesture dispatcher to
 * determine which tool's bindings are in scope; written by tool-switching
 * actions (`tool.activate`) and offhand hotkey actions (`tool.offhand`),
 * both parametric on `params.toolId`.
 *
 * The state hangs on the same scope tree as the actions and dep registries:
 * every canvas's input scope owns a tool of its own unless it joins a yoke,
 * and a provider above reads and writes the tool of the scope last used.
 */

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { ScopeNode } from './scopeNode';

/** Which tool is active, plus the stack of tools temporarily held active by a
 *  hotkey (space-for-hand and the like). The dispatcher reads this to decide
 *  whose bindings are in scope. */
export interface ActiveToolContextValue {
  /** The focused tool's id, or `null` when no tool holds the active slot —
   *  a canvas can run on ambient bindings alone. */
  active: string | null;
  hotkeyStack: string[];
  setActive(id: string | null): void;
  pushHotkey(id: string): void;
  /**
   * Disengage a hotkey-held tool. With `id`, removes that tool's own entry
   * wherever it now sits — holds do not have to come up in the order they went
   * down, and popping the top would disengage a tool whose key is still held.
   * With no id, pops the top.
   */
  popHotkey(id?: string): void;
}

interface ToolState {
  active: string | null;
  hotkeyStack: string[];
}

/**
 * One node of the tool tree. A node that `owns` a tool holds its state; one
 * that does not — a scope inside a yoke — reads and writes its yoke's.
 */
export class ToolNode extends ScopeNode<ToolNode> {
  private state: ToolState | null;
  private value: { from: ToolNode; state: ToolState; out: ActiveToolContextValue } | null = null;

  constructor(parent: ToolNode | null, descends: boolean, owns: boolean, initialActive: string | null) {
    super(parent, descends);
    // A new scope starts on the tool in effect around it, so a tool a
    // consumer seeded above a canvas before it mounted is not lost.
    this.state = owns
      ? { active: initialActive ?? parent?.owner().state?.active ?? null, hotkeyStack: [] }
      : null;
  }

  /** The node whose tool a read here resolves to. */
  owner(): ToolNode {
    for (const n of this.start().chain()) if (n.state) return n;
    return this;
  }

  private update(next: (s: ToolState) => ToolState): void {
    const owner = this.owner();
    if (!owner.state) return;
    const updated = next(owner.state);
    if (updated === owner.state) return;
    owner.state = updated;
    owner.changed();
  }

  /** A stable value per owner and state, for `useSyncExternalStore`. */
  snapshot(): ActiveToolContextValue {
    const from = this.owner();
    const state = from.state ?? { active: null, hotkeyStack: [] };
    const cached = this.value;
    if (cached && cached.from === from && cached.state === state) return cached.out;
    const out: ActiveToolContextValue = {
      active: state.active,
      hotkeyStack: state.hotkeyStack,
      setActive: (id) => this.update((s) => (s.active === id ? s : { ...s, active: id })),
      pushHotkey: (id) => this.update((s) => ({ ...s, hotkeyStack: [...s.hotkeyStack, id] })),
      popHotkey: (id) =>
        this.update((s) => {
          const stack = s.hotkeyStack;
          if (stack.length === 0) return s;
          if (id === undefined) return { ...s, hotkeyStack: stack.slice(0, -1) };
          const i = stack.lastIndexOf(id);
          return i === -1 ? s : { ...s, hotkeyStack: [...stack.slice(0, i), ...stack.slice(i + 1)] };
        }),
    };
    this.value = { from, state, out };
    return out;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.tree.listeners.add(listener);
    return () => {
      this.tree.listeners.delete(listener);
    };
  };
}

const ActiveToolContext = createContext<ToolNode | null>(null);

/** @internal The context `<InputScope>` and `<Yoke>` provide a tool node through. */
export const ActiveToolNodeContext = ActiveToolContext;

/** Props for `<ActiveToolContextProvider>`. */
export interface ActiveToolContextProviderProps {
  children: ReactNode;
  /** Seeds the active slot, and wins over the first `useTools` call's
   *  `active`. Omitted, the slot starts empty and that call seeds it. */
  initialActive?: string | null;
}

/** Provides root active-tool state. Every canvas below has a tool of its own;
 *  reads and writes here reach the one last used. */
export function ActiveToolContextProvider({
  children,
  initialActive = null,
}: ActiveToolContextProviderProps) {
  const [node] = useState(() => new ToolNode(null, true, true, initialActive));
  return <ActiveToolContext.Provider value={node}>{children}</ActiveToolContext.Provider>;
}

function useNodeValue(node: ToolNode | null): ActiveToolContextValue | null {
  const subscribe = useMemo(() => node?.subscribe ?? NO_SUBSCRIBE, [node]);
  return useSyncExternalStore(
    subscribe,
    () => node?.snapshot() ?? null,
    () => node?.snapshot() ?? null,
  );
}

const NO_SUBSCRIBE = (): (() => void) => () => {};

/** The active-tool state in scope. Throws outside a provider; use
 *  `useOptionalActiveToolContext` where one is not guaranteed. */
export function useActiveToolContext(): ActiveToolContextValue {
  const value = useNodeValue(useContext(ActiveToolContext));
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
  return useNodeValue(useContext(ActiveToolContext));
}

/**
 * Conditional `<ActiveToolContextProvider>` wrapper. Mounts a provider only
 * when no parent provider is in scope — otherwise renders children unwrapped
 * so `<WeaselProvider>` defers to the host's existing scope.
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
