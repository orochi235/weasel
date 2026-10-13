import { useEffect, useState } from 'react';
import type { ModeMachine } from './machine';

/** The id of the mode the machine is in, re-rendering when it changes. */
export function useModeId(machine: ModeMachine): string {
  const [id, setId] = useState(machine.registry.current().id);
  useEffect(() => {
    return machine.registry.subscribe(() => setId(machine.registry.current().id));
  }, [machine]);
  return id;
}
