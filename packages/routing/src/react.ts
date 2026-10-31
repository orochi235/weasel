/**
 * @weasel-js/routing/react — the React seam.
 *
 * `useGestureDispatcher` is the only code in the kit that assembles a
 * `DispatcherContext` and pumps DOM events into it; everything else here is a
 * provider it reads from. React is an optional peer of this package, so a
 * kernel that drives routing itself imports only the main entry and never
 * loads any of this.
 *
 * @packageDocumentation
 */
export { useGestureDispatcher } from './interactions/dispatcher/useGestureDispatcher';
export type {
  UseGestureDispatcherOptions, DispatcherChannels,
} from './interactions/dispatcher/useGestureDispatcher';

export { ActionsProvider, useActionsRegistry, useAction } from './interactions/actions/ActionsProvider';
export { useCommand } from './interactions/actions/useCommand';
export { lastOperationOf, useLastOperation, useLastOperationStore } from './interactions/actions/useLastOperation';
export type { CommandOptions } from './interactions/actions/useCommand';
export { useMenuHost, useMenus } from './menus/MenuHostContext';
export { InputScope, useYoke, Yoke } from './interactions/actions/inputScope';
export type { InputScopeProps, YokeProps } from './interactions/actions/inputScope';
export { useOngoingAction } from './interactions/actions/useOngoingAction';
export { useOpenKeymap } from './keymaps/useOpenKeymap';
export type { OngoingAction } from './interactions/actions/useOngoingAction';
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

export {
  PointerContextProvider, createPointerStore, usePointerContext, usePointerPosition,
} from './ambient/PointerContext';
export type { PointerContextValue, PointerWorldPos } from './ambient/PointerContext';
export {
  SelectionContextProvider, SelectionContextProviderIfRoot, useSelectionContext, usePublishSelection,
} from './ambient/SelectionContext';
export type { SelectionContextValue } from './ambient/SelectionContext';

export { useTools } from './tools/useTools';
export type { UseToolsOptions, ToolsApi } from './tools/useTools';
export { useContributions, useOffhandAction } from './contributions/useContributions';
export type { ContributionsApi, UseContributionsOptions } from './contributions/useContributions';
