import { type ActionsRegistry, useActionsRegistry } from '@weasel-js/core';
import { useEffect } from 'react';

/** Puts the actions scope it renders in, a canvas's own, into `into`. */
export function ScopeOf({ into }: { into: { current: ActionsRegistry | null } }): null {
  const registry = useActionsRegistry();
  useEffect(() => {
    into.current = registry;
    return () => {
      if (into.current === registry) into.current = null;
    };
  }, [into, registry]);
  return null;
}
