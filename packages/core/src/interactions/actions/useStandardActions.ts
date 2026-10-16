/**
 * @experimental
 * `useStandardActions` — register the kit-standard action descriptors into the
 * nearest `<ActionsProvider>` and publish dep sources into the nearest
 * `<DepRegistryProvider>`. Falls back silently to a no-op when either is
 * not in scope.
 */
import type { Action } from '@weasel-js/routing';
import { KIT_STANDARD_ACTIONS } from '../../canvas/SceneCanvas/namedPresets';
import { useActionSet, useStandardDeps, type StandardDeps } from './useActionSet';

/** @experimental */
export interface UseStandardActionsOptions extends StandardDeps {
  /**
   * The actions to register, in order. Default: every kit-standard action
   * (`KIT_STANDARD_ACTION_IDS`). A preset's `actions` is a set in this form.
   */
  actions?: readonly Action[];
  /**
   * Ids of kit-standard actions to leave unregistered, so a consumer can bind
   * its own. Ids that name no kit action are ignored;
   * `KIT_STANDARD_ACTION_IDS` is the full list.
   */
  exclude?: Iterable<string>;
}

/** Every id `useStandardActions` can register, each core preset's in turn and
 *  then the tool-driven ones. It holds `clipboard.pasteEvent` back while
 *  `ingest` is registered. */
export const KIT_STANDARD_ACTION_IDS: readonly string[] = KIT_STANDARD_ACTIONS.map((a) => a.id);

/**
 * @experimental
 * Register each kit-standard dep source and action descriptor into the
 * surrounding `<ActionsProvider>` and `<DepRegistryProvider>` (typically
 * provided by `<SceneCanvas>`); a silent no-op when either is absent.
 *
 * Each dep option is published as a live source in the dep registry under its
 * canonical name (`selection`, `scene`, …). The source reads the latest
 * option value at invocation time, so consumers don't have to memoize their
 * dep objects.
 */
export function useStandardActions(opts: UseStandardActionsOptions): void {
  const { actions = KIT_STANDARD_ACTIONS, exclude, ...deps } = opts;
  useStandardDeps(deps);
  useActionSet(actions, exclude);
}
