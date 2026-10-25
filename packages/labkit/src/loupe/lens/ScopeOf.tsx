import { type ActionsRegistry, useActionsRegistry } from '@weasel-js/core';
import { useEffect } from 'react';

/** Hands `onScope` the actions scope it renders in, a canvas's own when it is that canvas's child. */
export function ScopeOf({
  onScope,
}: {
  onScope: (registry: ActionsRegistry | null) => void;
}): null {
  const registry = useActionsRegistry();
  useEffect(() => {
    onScope(registry);
    return () => onScope(null);
  }, [onScope, registry]);
  return null;
}
