/**
 * `<WeaselProvider>` — top-level convenience that mounts all five kit-root
 * contexts in a single wrap. By default each underlying provider uses its
 * `IfRoot` variant, so `<WeaselProvider>` is safely nestable: when a parent
 * `<WeaselProvider>` (or any of the individual providers) is already in
 * scope, the inner one renders its children unwrapped and defers to the
 * parent registry. `isolate` opts out of that.
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
import type { ComponentType, ReactNode } from 'react';
import { DepRegistryProviderIfRoot } from './canvas/SceneCanvas/DepRegistryProviderIfRoot';
import { ActionsProviderIfRoot } from './canvas/SceneCanvas/ActionsProviderIfRoot';
import { PointerProviderIfRoot } from './canvas/SceneCanvas/PointerProviderIfRoot';
import {
  ActiveToolContextProvider,
  ActiveToolContextProviderIfRoot,
} from './interactions/actions/activeToolContext';
import {
  SelectionContextProvider,
  SelectionContextProviderIfRoot,
} from './features/selection/SelectionContext';
import { DepRegistryProvider } from './interactions/actions/depRegistry';
import { ActionsProvider } from './interactions/actions/registry';
import { PointerContextProvider } from './features/pointer/PointerContext';

type Wrapper = ComponentType<{ children: ReactNode }>;

export interface WeaselProviderProps {
  children: ReactNode;
  /**
   * Mount every provider unconditionally rather than deferring to one already
   * in scope.
   *
   * An actions registry holds one dispatcher, so a second `<SceneCanvas>`
   * joining a scope displaces the first and takes its input away. Two canvases
   * on one page each want their own scope; wrap each in an isolated provider.
   * The cost is that they share nothing — a toolbar outside both can drive
   * neither.
   */
  isolate?: boolean;
}

/**
 * Mounts every kit-wide provider at once — deps, actions, active tool,
 * selection and pointer — each only if one is not already in scope, or
 * unconditionally under `isolate`.
 *
 * `<SceneCanvas>` does this for itself, so this is for the case where kit
 * state has to be shared by things outside a canvas: a toolbar, a property
 * panel, or two canvases that should agree on the selection.
 */
export function WeaselProvider({ children, isolate = false }: WeaselProviderProps) {
  const Deps: Wrapper = isolate ? DepRegistryProvider : DepRegistryProviderIfRoot;
  const Actions: Wrapper = isolate ? ActionsProvider : ActionsProviderIfRoot;
  const ActiveTool: Wrapper = isolate
    ? ActiveToolContextProvider
    : ActiveToolContextProviderIfRoot;
  const Selection: Wrapper = isolate
    ? SelectionContextProvider
    : SelectionContextProviderIfRoot;
  const Pointer: Wrapper = isolate ? PointerContextProvider : PointerProviderIfRoot;
  return (
    <Deps>
      <Actions>
        <ActiveTool>
          <Selection>
            <Pointer>
              {children}
            </Pointer>
          </Selection>
        </ActiveTool>
      </Actions>
    </Deps>
  );
}
