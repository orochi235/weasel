import {
  type ActionsRegistry,
  PointerContextProvider,
  useActionsRegistry,
  WeaselProvider,
} from '@weasel-js/core';
import { type ComponentProps, type ReactNode, useEffect } from 'react';

/** The trial's root action registry, held for its chrome, which sits above the registry's provider. */
export interface TrialActions {
  /** Runs `id` with `params` on the trial's registry, as `ActionsRegistry.trigger` does: whether it ran. */
  run(id: string, params?: unknown): boolean;
  /** Holds `registry` until the returned release. */
  attach(registry: Pick<ActionsRegistry, 'trigger'>): () => void;
}

export function createTrialActions(): TrialActions {
  let held: Pick<ActionsRegistry, 'trigger'> | null = null;
  return {
    run: (id, params) => held?.trigger(id, params as never) ?? false,
    attach(registry) {
      held = registry;
      return () => {
        if (held === registry) held = null;
      };
    },
  };
}

function HoldActions({ actions }: { actions: TrialActions }) {
  const registry = useActionsRegistry();
  useEffect(() => (registry ? actions.attach(registry) : undefined), [actions, registry]);
  return null;
}

/** The trial's root registries, isolated from the trial beside it, with its pointer store, and its action registry
 *  handed to `actions`. Each camera inside mounts an input scope under them. */
export function TrialScope({
  pointer,
  actions,
  children,
}: {
  pointer: ComponentProps<typeof PointerContextProvider>['store'];
  actions: TrialActions;
  children: ReactNode;
}) {
  return (
    <WeaselProvider isolate>
      <PointerContextProvider store={pointer}>
        <HoldActions actions={actions} />
        {children}
      </PointerContextProvider>
    </WeaselProvider>
  );
}
