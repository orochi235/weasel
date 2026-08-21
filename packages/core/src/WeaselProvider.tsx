/**
 * `<WeaselProvider>` — top-level convenience that mounts all five kit-root
 * contexts in a single wrap. Each underlying provider uses its `IfRoot`
 * variant, so `<WeaselProvider>` is safely nestable: when a parent
 * `<WeaselProvider>` (or any of the individual providers) is already in
 * scope, the inner one renders its children unwrapped and defers to the
 * parent registry.
 *
 * Use this at the harness / app root above any `useTools(...)` call so the
 * resulting `ToolsApi` is bound to the same `ActiveToolContext` the
 * surrounding `<SceneCanvas>` reads — otherwise keybinding-driven tool
 * switches update local state in the outer `useTools` but the dispatcher
 * (which reads the context) sees a stale active tool.
 *
 * Provider nesting order matches the order `<SceneCanvas>` mounts them
 * internally so swapping a manual SceneCanvas-wrapping setup for
 * `<WeaselProvider>` doesn't change effect ordering.
 */
import type { ReactNode } from 'react';
import { DepRegistryProviderIfRoot } from './canvas/SceneCanvas/DepRegistryProviderIfRoot';
import { ActionsProviderIfRoot } from './canvas/SceneCanvas/ActionsProviderIfRoot';
import { ActiveToolContextProviderIfRoot } from './interactions/actions/activeToolContext';
import { SelectionContextProviderIfRoot } from './features/selection/SelectionContext';
import { PointerProviderIfRoot } from './canvas/SceneCanvas/PointerProviderIfRoot';

/**
 * Mounts every kit-wide provider at once — deps, actions, active tool,
 * selection and pointer — each only if one is not already in scope.
 *
 * `<SceneCanvas>` does this for itself, so this is for the case where kit
 * state has to be shared by things outside a canvas: a toolbar, a property
 * panel, or two canvases that should agree on the selection.
 */
export function WeaselProvider({ children }: { children: ReactNode }) {
  return (
    <DepRegistryProviderIfRoot>
      <ActionsProviderIfRoot>
        <ActiveToolContextProviderIfRoot>
          <SelectionContextProviderIfRoot>
            <PointerProviderIfRoot>
              {children}
            </PointerProviderIfRoot>
          </SelectionContextProviderIfRoot>
        </ActiveToolContextProviderIfRoot>
      </ActionsProviderIfRoot>
    </DepRegistryProviderIfRoot>
  );
}
