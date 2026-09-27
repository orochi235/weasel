/**
 * `useContributionRoles` — installs the roles of every entry in the tools
 * registry that a surface owns rather than the dispatcher: its actions into the
 * `<ActionsProvider>`, its deps into the dep registry, and its `attach` against
 * the mounted canvas. Views are the fourth such role; `<SceneCanvas>` renders
 * those itself, because a view is a component.
 *
 * Tool hooks run wherever the consumer calls them, which may be outside any
 * registry. Declaring roles on the entry and installing them from in here keeps
 * the tool hook callable from anywhere.
 */
import { useEffect, useRef } from 'react';
import { useActionsRegistry, useOffhandAction, useOptionalDepRegistry } from '@weasel-js/routing/react';
import type { DepRegistry } from '@weasel-js/routing/react';
import type { DepName } from 'interactions/actions/depSchema';
import type { ToolsApi } from '../../tools/overlayBinding';
import type { CanvasExtensionApi } from '../canvasExtension';
import type { SurfaceContribution } from '../surfaceContribution';

/** Every entry the registry holds, registry and ambient alike. */
export function contributionEntries(tools: Pick<ToolsApi, 'registry' | 'ambient'>): SurfaceContribution[] {
  return [...Object.values(tools.registry), ...tools.ambient] as SurfaceContribution[];
}

/**
 * Keep one installation per key alive: install keys that appeared, tear down
 * keys that went. Keys are role objects the consumer owns, so an entry the
 * host re-wraps every render — `useTools` restates eligibility on a copy —
 * still installs once.
 */
function useKeyedInstall(
  items: ReadonlyMap<object, () => () => void>,
): void {
  const live = useRef(new Map<object, () => void>());
  useEffect(() => {
    for (const [key, teardown] of live.current) {
      if (items.has(key)) continue;
      teardown();
      live.current.delete(key);
    }
    for (const [key, install] of items) {
      if (live.current.has(key)) continue;
      live.current.set(key, install());
    }
  });
  useEffect(() => () => {
    for (const teardown of live.current.values()) teardown();
    live.current.clear();
  }, []);
}

export function useContributionRoles(
  tools: ToolsApi,
  api: CanvasExtensionApi | null,
): void {
  const registry = useActionsRegistry();
  const depRegistry = useOptionalDepRegistry();
  const { registry: toolRegistry, ambient } = tools;

  useEffect(() => {
    if (!registry) return;
    const unregisters: Array<() => void> = [];
    // Ambient entries included: an always-on entry owns actions its own
    // bindings reference exactly as a registry tool does, and leaving them out
    // gives the same silent failure this hook exists to prevent — a binding
    // pointing at an id nothing registered.
    for (const entry of contributionEntries({ registry: toolRegistry, ambient })) {
      for (const action of entry.actions ?? []) {
        unregisters.push(registry.register(action));
      }
    }
    return () => { for (const u of unregisters) u(); };
  }, [registry, toolRegistry, ambient]);

  const installs = new Map<object, () => () => void>();
  for (const entry of contributionEntries(tools)) {
    const deps = entry.deps;
    if (deps && depRegistry) installs.set(deps, () => registerDeps(depRegistry, deps));
    const attach = entry.attach;
    if (attach && api) {
      const reader = depRegistry ?? { get: () => undefined };
      installs.set(attach, () => attach(api, reader));
    }
  }
  useKeyedInstall(installs);

  // Tool assembly runs above the provider too, so its own registration of
  // held-key engagement finds no registry unless the consumer mounted one.
  useOffhandAction(contributionEntries(tools));
}

function registerDeps(
  depRegistry: DepRegistry,
  deps: NonNullable<SurfaceContribution['deps']>,
): () => void {
  const unregisters = (Object.keys(deps) as DepName[]).map((name) =>
    depRegistry.register(name, deps[name] as never));
  return () => { for (const u of unregisters) u(); };
}
