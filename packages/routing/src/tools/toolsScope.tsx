import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createEmitter } from '@weasel-js/registry';
import type { ToolsApi } from './useTools';

/** Where a canvas publishes its tools, for a palette or a bar inside it or beside it. The canvas that published
 *  last holds it, as the actions registry of a shared scope follows the canvas that joined it last. */
class ToolsSlot {
  private tools: ToolsApi | null = null;
  private owner: object | null = null;
  private readonly changed = createEmitter();

  get = (): ToolsApi | null => this.tools;

  subscribe = (listener: () => void): (() => void) => this.changed.subscribe(listener);

  publish(owner: object, tools: ToolsApi): () => void {
    this.set(owner, tools);
    return () => {
      if (this.owner === owner) this.set(null, null);
    };
  }

  private set(owner: object | null, tools: ToolsApi | null): void {
    this.owner = owner;
    if (this.tools === tools) return;
    this.tools = tools;
    this.changed.emit();
  }
}

const ToolsSlotContext = createContext<ToolsSlot | null>(null);

/** Mounts a slot for canvas tools, always (`isolate`) or only where none is in scope. */
export function ToolsScope({ children, isolate = false }: { children: ReactNode; isolate?: boolean }) {
  const outer = useContext(ToolsSlotContext);
  const [own] = useState(() => new ToolsSlot());
  if (outer && !isolate) return <>{children}</>;
  return <ToolsSlotContext.Provider value={own}>{children}</ToolsSlotContext.Provider>;
}

/** Publishes a canvas's tools into the slot in scope while the canvas is mounted. */
export function usePublishTools(tools: ToolsApi): void {
  const slot = useContext(ToolsSlotContext);
  const [owner] = useState(() => ({}));
  useLayoutEffect(() => slot?.publish(owner, tools), [slot, owner, tools]);
}

const NO_SUBSCRIBE = () => () => {};
const NONE = () => null;

/**
 * The tools of the canvas this sits in, or beside under a shared `WeaselProvider`: the `ToolsApi` its
 * `onToolsCreated` hands over, kept current as the active tool changes. `null` while no canvas in scope has
 * mounted. Where several canvases share a scope, it is the tools of the one that published last.
 */
export function useScopedTools(): ToolsApi | null {
  const slot = useContext(ToolsSlotContext);
  return useSyncExternalStore(slot?.subscribe ?? NO_SUBSCRIBE, slot?.get ?? NONE, slot?.get ?? NONE);
}
