import { useEffect } from 'react';
import type { ActionTuning, ActionTunings, BindingOverrides } from '@weasel-js/routing';
import { useActionsRegistry } from '@weasel-js/routing/react';

/** Hold `tune`'s tunings on the registry in scope for as long as the object
 *  is the same one. */
export function useActionTunings(tune: ActionTunings | undefined): void {
  const reg = useActionsRegistry();
  useEffect(() => {
    if (!reg || !tune) return;
    const releases = Object.entries(tune).flatMap(([id, t]) => (t ? [reg.tune(id, t as ActionTuning)] : []));
    return () => { for (const release of releases) release(); };
  }, [reg, tune]);
}

/** Hold `overrides` on the registry in scope for as long as the object is the same one. */
export function useBindingOverrides(overrides: BindingOverrides | undefined): void {
  const reg = useActionsRegistry();
  useEffect(() => (reg && overrides ? reg.overrideBindings(overrides) : undefined), [reg, overrides]);
}
