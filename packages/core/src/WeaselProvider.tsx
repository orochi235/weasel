import type { ComponentType, ReactNode } from 'react';
import {
  IconRegistryProvider,
  IconRegistryProviderIfRoot,
  type IconRegistryProviderProps,
} from './iconRegistry';
import { DepRegistryProviderIfRoot } from './canvas/SceneCanvas/DepRegistryProviderIfRoot';
import { ActionsProviderIfRoot } from './canvas/SceneCanvas/ActionsProviderIfRoot';
import { PointerProviderIfRoot } from './canvas/SceneCanvas/PointerProviderIfRoot';
import { ActiveToolContextProvider, ActiveToolContextProviderIfRoot } from '@weasel-js/routing/react';
import {
  SelectionContextProvider,
  SelectionContextProviderIfRoot,
} from '@weasel-js/routing/react';
import { DepRegistryProvider } from '@weasel-js/routing/react';
import { ActionsProvider } from '@weasel-js/routing/react';
import { PointerContextProvider } from '@weasel-js/routing/react';

type Wrapper = ComponentType<{ children: ReactNode }>;

/** Props for {@link WeaselProvider}. */
export interface WeaselProviderProps {
  children: ReactNode;
  /**
   * Mount every provider unconditionally rather than deferring to one already
   * in scope.
   *
   * An actions registry holds one dispatcher, so a second `<SceneCanvas>`
   * joining a scope displaces the first and takes its input away. Wrap each of
   * two canvases on one page in an isolated provider. They then share
   * nothing — a toolbar outside both can drive neither.
   */
  isolate?: boolean;
  /** Icon tables to register, e.g. `virtual:weasel-icons`'s default export. Mounts a registry of its own rather than joining one in scope. */
  icons?: IconRegistryProviderProps['icons'];
  /** Icon variants a component may load by name. Mounts a registry of its own, like `icons`. */
  iconVariants?: IconRegistryProviderProps['variants'];
}

/**
 * Mounts every kit-wide provider at once — deps, actions, active tool,
 * selection, and pointer — each only if one is not already in scope, or
 * unconditionally under `isolate`.
 *
 * `<SceneCanvas>` does this for itself, so this is for the case where kit
 * state has to be shared by things outside a canvas: a toolbar, a property
 * panel, or two canvases that should agree on the selection. Mount it above
 * any `useTools(...)` call, or the dispatcher sees a stale active tool.
 */
export function WeaselProvider({ children, isolate = false, icons, iconVariants }: WeaselProviderProps) {
  const Deps: Wrapper = isolate ? DepRegistryProvider : DepRegistryProviderIfRoot;
  const Actions: Wrapper = isolate ? ActionsProvider : ActionsProviderIfRoot;
  const ActiveTool: Wrapper = isolate
    ? ActiveToolContextProvider
    : ActiveToolContextProviderIfRoot;
  const Selection: Wrapper = isolate
    ? SelectionContextProvider
    : SelectionContextProviderIfRoot;
  const Pointer: Wrapper = isolate ? PointerContextProvider : PointerProviderIfRoot;
  const tree = (
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
  // `isolate` leaves the icon registry alone: icons are the app's, settled when it is built.
  if (icons || iconVariants) {
    return (
      <IconRegistryProvider icons={icons} variants={iconVariants}>
        {tree}
      </IconRegistryProvider>
    );
  }
  return <IconRegistryProviderIfRoot>{tree}</IconRegistryProviderIfRoot>;
}
