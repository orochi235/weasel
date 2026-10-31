/**
 * An actions tree with a last-operation store over a gesture's deps, for tests
 * of a drag's replay: the keeper undoes the drag's entry, puts back the
 * selection it started on, and replays it, as the panel does.
 */
import { act, render } from '@testing-library/react';
import type { Action, ActionsRegistry, DepName, DepRegistry, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { ActionsProvider, DepRegistryProvider, lastOperationOf, useActionsRegistry, useDepRegistry } from '@weasel-js/core';

interface Selection { get(): readonly string[]; set(ids: readonly string[]): void }

/** `actions` registered over `deps`, which hold a `history` and a `selection`. */
export function lastOperationHarness(deps: Record<string, unknown>, actions: readonly Action[]) {
  let registry: ActionsRegistry | null = null;
  let depRegistry: DepRegistry | null = null;
  function Grab() {
    registry = useActionsRegistry();
    depRegistry = useDepRegistry();
    return null;
  }
  render(<DepRegistryProvider><ActionsProvider><Grab /></ActionsProvider></DepRegistryProvider>);
  const selection = deps.selection as Selection;
  act(() => {
    for (const [name, value] of Object.entries(deps)) depRegistry!.register(name as DepName, () => value as never);
    depRegistry!.register('selectionSnapshot', () => ({
      take: () => {
        const was = [...selection.get()];
        return () => selection.set(was);
      },
    }));
    for (const a of actions) registry!.register(a);
  });
  const store = lastOperationOf(registry)!;
  /** Start `id`'s gesture as the dispatcher would, through the tree's live descriptor. */
  const start = (id: string, ctx: InvocationCtx, params?: Record<string, unknown>): OngoingHandle => {
    const invoker = registry!.list().find((a) => a.id === id)?.invoker as OngoingInvoker | undefined;
    if (invoker?.timing !== 'ongoing') throw new Error(`${id} is not an ongoing action`);
    return invoker.start(ctx, params ? { params } : undefined);
  };
  return {
    registry: registry!,
    store,
    start,
    adjust: (patch: Record<string, unknown>) => act(() => { store.adjust(patch); }),
  };
}
