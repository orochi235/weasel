/**
 * @weasel-js/routing/react — the React seam.
 *
 * `useGestureDispatcher` is the only code in the kit that assembles a
 * `DispatcherContext` and pumps DOM events into it; everything else here is a
 * provider it reads from. React is an optional peer of this package, so a
 * kernel that drives routing itself imports only the main entry and never
 * loads any of this.
 */
export { useGestureDispatcher } from './interactions/dispatcher/useGestureDispatcher';
export type {
  UseGestureDispatcherOptions, DispatcherChannels, DispatcherViewTarget, ViewIdResolver,
} from './interactions/dispatcher/useGestureDispatcher';

export { ActionsProvider, ActionsScope, useActionsRegistry, useAction } from './interactions/actions/ActionsProvider';
export {
  DepRegistryProvider, useDepRegistry, useOptionalDepRegistry, useDepSource,
} from './interactions/actions/depRegistry';
export type { DepRegistry } from './interactions/actions/depRegistry';
export {
  ActiveToolContextProvider, ActiveToolContextProviderIfRoot,
  useActiveToolContext, useOptionalActiveToolContext,
} from './interactions/actions/activeToolContext';
export type {
  ActiveToolContextValue, ActiveToolContextProviderProps,
} from './interactions/actions/activeToolContext';

export { useTools } from './tools/useTools';
export type { UseToolsOptions, ToolsApi } from './tools/useTools';
export { useContributions } from './contributions/useContributions';
export type { ContributionsApi, UseContributionsOptions } from './contributions/useContributions';
