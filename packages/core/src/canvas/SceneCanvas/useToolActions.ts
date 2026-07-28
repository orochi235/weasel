/**
 * `useToolActions` — registers every `Tool.actions` entry in the tools
 * registry into the `<ActionsProvider>` in scope.
 *
 * Tool hooks run wherever the consumer calls them. For `<SceneCanvas>` that
 * is `SceneCanvasInner`, which sits ABOVE `<ActionsProviderIfRoot>` — so a
 * tool that registered its own action with `useAction` got a null registry
 * and silently no-op'd, leaving its bindings pointing at an action id nothing
 * had registered. The dispatcher then fell through to whatever matched next.
 * That is why polygon/star's wheel- and arrow-key side adjustment did nothing
 * while `nudge.*` moved the selection instead.
 *
 * Declaring the actions on the tool (`ToolDef.actions`) and registering them
 * from in here keeps the tool hook callable from anywhere.
 */
import { useEffect } from 'react';
import { useActionsRegistry } from 'interactions/actions/registry';
import type { ToolsApi } from 'tools/useTools';

export function useToolActions(tools: ToolsApi): void {
  const registry = useActionsRegistry();

  useEffect(() => {
    if (!registry) return;
    const unregisters: Array<() => void> = [];
    // Ambient tools included: an always-on tool owns actions its own bindings
    // reference exactly as a registry tool does, and leaving them out gives
    // the same silent failure this hook exists to prevent — a binding
    // pointing at an id nothing registered.
    for (const tool of [...Object.values(tools.registry), ...tools.ambient]) {
      for (const action of tool.actions ?? []) {
        unregisters.push(registry.register(action));
      }
    }
    return () => { for (const u of unregisters) u(); };
  }, [registry, tools.registry, tools.ambient]);
}
